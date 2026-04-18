import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdanodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { TitanEnvironmentVariables } from "../../types";

export interface GenerationStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  subnets: ec2.ISubnet[];
  dynamodbPolicy: iam.PolicyStatement;
  environment: TitanEnvironmentVariables;
  dockerFilePath: string;
  athenaFullAccess: iam.IManagedPolicy;
  metafinderMetadataBucket: s3.IBucket;
  metafinderDataBucket: s3.IBucket;
  jobsBucket: s3.IBucket;
  locationThumbnailPrefix: string;
  websocketApiKey: string;
  websocketEndpoint: string;
  eksClusterName: string;
  eksOidcProviderArn: string;
  eksOidcIssuerHostPath: string;
}

export class GenerationStack extends cdk.NestedStack {
  public readonly logGroup: logs.LogGroup;
  public readonly generationEcrRepo: ecr.Repository;
  public readonly generationIrsaRole: iam.Role;
  public readonly createRandomJobFn: lambda.DockerImageFunction;
  public readonly generateEntitiesFn: lambda.DockerImageFunction;
  public readonly genertaeLocationThumbnailFn: lambdanodejs.NodejsFunction;
  public readonly environmentVariables: TitanEnvironmentVariables;

  constructor(scope: Construct, id: string, props: GenerationStackProps) {
    super(scope, id);

    const {
      vpc,
      dynamodbPolicy,
      environment,
      dockerFilePath,
      athenaFullAccess,
      metafinderDataBucket,
      metafinderMetadataBucket,
      jobsBucket,
      locationThumbnailPrefix,
      subnets,
      eksClusterName,
      eksOidcProviderArn,
      eksOidcIssuerHostPath,
    } = props;
    this.environmentVariables = environment;

    // --- Lambda functions (unchanged) ---

    this.createRandomJobFn = new lambda.DockerImageFunction(
      this,
      "CreateRandomJobFn",
      {
        code: lambda.DockerImageCode.fromImageAsset(dockerFilePath, {
          file: "./docker/randomJob.lambda.Dockerfile",
        }),
        vpc,
        vpcSubnets: {
          subnets,
        },
        // @ts-expect-error - TitanEnvironmentVariables not compatible with Lambda function environment
        environment: this.environmentVariables,
        timeout: cdk.Duration.minutes(15),
        memorySize: 10240,
        initialPolicy: [dynamodbPolicy],
      },
    );

    this.generateEntitiesFn = new lambda.DockerImageFunction(
      this,
      "GenerateEntitiesFn",
      {
        code: lambda.DockerImageCode.fromImageAsset(dockerFilePath, {
          file: "./docker/generateEntities.lambda.Dockerfile",
        }),
        vpc,
        vpcSubnets: {
          subnets,
        },
        // @ts-expect-error - TitanEnvironmentVariables not compatible with Lambda function environment
        environment: this.environmentVariables,
        timeout: cdk.Duration.minutes(15),
        memorySize: 10240,
        initialPolicy: [dynamodbPolicy],
      },
    );

    metafinderMetadataBucket.grantReadWrite(this.generateEntitiesFn);
    this.generateEntitiesFn.role?.addManagedPolicy(athenaFullAccess);

    this.genertaeLocationThumbnailFn = new lambdanodejs.NodejsFunction(
      this,
      "GenerateLocationThumbnailFn",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          "../../src/backend/services/location_thumbnail",
        ),
        environment: {
          BUCKET_NAME: jobsBucket.bucketName,
          PREFIX: locationThumbnailPrefix,
        },
        timeout: cdk.Duration.minutes(2),
      },
    );

    jobsBucket.grantReadWrite(this.genertaeLocationThumbnailFn);

    this.environmentVariables.TITAN_GENERATE_LOCATION_THUMBNAIL_LAMBDA_NAME =
      this.genertaeLocationThumbnailFn.functionName;

    // --- EKS generation job resources (replaces ECS Fargate) ---

    this.generationEcrRepo = new ecr.Repository(this, "GenerationEcrRepo", {
      repositoryName: "titan-generation",
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.logGroup = new logs.LogGroup(this, "GenerationLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // IRSA role for the generation K8s service account
    const eksNamespace = "titan";
    const eksServiceAccount = "titan-generation";

    this.generationIrsaRole = new iam.Role(this, "GenerationIrsaRole", {
      assumedBy: new iam.FederatedPrincipal(
        eksOidcProviderArn,
        {
          StringEquals: {
            [`${eksOidcIssuerHostPath}:aud`]: "sts.amazonaws.com",
            [`${eksOidcIssuerHostPath}:sub`]: `system:serviceaccount:${eksNamespace}:${eksServiceAccount}`,
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
      inlinePolicies: {
        GenerationPolicy: new iam.PolicyDocument({
          statements: [dynamodbPolicy],
        }),
      },
    });

    this.generationIrsaRole.addManagedPolicy(athenaFullAccess);
    metafinderDataBucket.grantRead(this.generationIrsaRole);
    metafinderMetadataBucket.grantReadWrite(this.generationIrsaRole);
    jobsBucket.grantReadWrite(this.generationIrsaRole);
    this.genertaeLocationThumbnailFn.grantInvoke(this.generationIrsaRole);

    this.environmentVariables.TITAN_GENERATE_ENTITIES_LAMBDA_NAME =
      this.generateEntitiesFn.functionName;
    this.environmentVariables.TITAN_RANDOM_JOB_LAMBDA_NAME =
      this.createRandomJobFn.functionName;

    // EKS generation job settings
    this.environmentVariables.TITAN_GENERATION_JOB_EKS_CLUSTER = eksClusterName;
    this.environmentVariables.TITAN_GENERATION_JOB_EKS_NAMESPACE = eksNamespace;
    this.environmentVariables.TITAN_GENERATION_JOB_EKS_IMAGE =
      this.generationEcrRepo.repositoryUri;
    this.environmentVariables.TITAN_GENERATION_JOB_EKS_SERVICE_ACCOUNT =
      eksServiceAccount;

    new cdk.CfnOutput(this, "GenerationEcrRepoUri", {
      value: this.generationEcrRepo.repositoryUri,
    });
    new cdk.CfnOutput(this, "GenerationIrsaRoleArn", {
      value: this.generationIrsaRole.roleArn,
    });
  }
}
