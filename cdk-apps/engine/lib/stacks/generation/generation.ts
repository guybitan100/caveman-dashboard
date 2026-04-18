import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdanodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { SixEnvironmentVariables } from "../../types";

export interface GenerationStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  subnets: ec2.ISubnet[];
  dynamodbPolicy: iam.PolicyStatement;
  environment: SixEnvironmentVariables;
  dockerFilePath: string;
  athenaFullAccess: iam.IManagedPolicy;
  metafinderMetadataBucket: s3.IBucket;
  metafinderDataBucket: s3.IBucket;
  jobsBucket: s3.IBucket;
  locationThumbnailPrefix: string;
  websocketApiKey: string;
  websocketEndpoint: string;
}

export class GenerationStack extends cdk.NestedStack {
  private securityGroup: ec2.SecurityGroup;
  private container: ecs.ContainerDefinition;
  private cluster: ecs.Cluster;
  public readonly logGroup: logs.LogGroup;
  public readonly taskDefinition: ecs.TaskDefinition;
  public readonly createRandomJobFn: lambda.DockerImageFunction;
  public readonly generateEntitiesFn: lambda.DockerImageFunction;
  public readonly genertaeLocationThumbnailFn: lambdanodejs.NodejsFunction;
  public readonly environmentVariables: SixEnvironmentVariables;

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
    } = props;
    this.environmentVariables = environment;

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
        // @ts-expect-error - SixEnvironmentVariables not compatible with Lambda function environment
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
        // @ts-expect-error - SixEnvironmentVariables not compatible with Lambda function environment
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

    this.environmentVariables.SIX_GENERATE_LOCATION_THUMBNAIL_LAMBDA_NAME =
      this.genertaeLocationThumbnailFn.functionName;

    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENHANCED,
    });

    this.taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "GenerationTaskDef",
      {
        memoryLimitMiB: 1024 * 64, // 64 GB
        cpu: 1024 * 16, // 16 vCPU
        ephemeralStorageGiB: 50,
        taskRole: new iam.Role(this, "GenerationTaskRole", {
          assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
          managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName(
              "service-role/AmazonECSTaskExecutionRolePolicy",
            ),
          ],
          inlinePolicies: {
            GenerationPolicy: new iam.PolicyDocument({
              statements: [dynamodbPolicy],
            }),
          },
        }),
      },
    );

    this.taskDefinition.taskRole?.addManagedPolicy(athenaFullAccess);
    metafinderDataBucket.grantRead(this.taskDefinition.taskRole);
    metafinderMetadataBucket.grantReadWrite(this.taskDefinition.taskRole);

    this.logGroup = new logs.LogGroup(this, "GenerationLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    this.container = this.taskDefinition.addContainer("GenerationContainer", {
      image: ecs.ContainerImage.fromAsset(dockerFilePath, {
        file: "./docker/generation.ecs.Dockerfile",
      }),
      memoryLimitMiB: 1024 * 64, // 64 GB
      cpu: 1024 * 16, // 16 vCPU
      containerName: "GenerationContainer",
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "Generation",
        logGroup: this.logGroup,
      }),
      // @ts-expect-error - SixEnvironmentVariables not compatible with ContainerDefinition environment
      environment: this.environmentVariables,
    });

    this.securityGroup = new ec2.SecurityGroup(this, "GenerateSG", {
      vpc,
    });

    jobsBucket.grantReadWrite(this.taskDefinition.taskRole);
    metafinderDataBucket.grantRead(this.taskDefinition.taskRole);
    this.genertaeLocationThumbnailFn.grantInvoke(this.taskDefinition.taskRole);

    this.environmentVariables.SIX_GENERATE_ENTITIES_LAMBDA_NAME =
      this.generateEntitiesFn.functionName;
    this.environmentVariables.SIX_RANDOM_JOB_LAMBDA_NAME =
      this.createRandomJobFn.functionName;
    this.environmentVariables.SIX_GENERATION_JOB_FARGATE_ARN =
      this.taskDefinition.taskDefinitionArn;
    this.environmentVariables.SIX_GENERATION_JOB_FARGATE_CLUSTER =
      this.cluster.clusterName;
    this.environmentVariables.SIX_GENERATION_JOB_FARGATE_SUBNETS =
      JSON.stringify(subnets.map((subnet) => subnet.subnetId));
    this.environmentVariables.SIX_GENERATION_JOB_FARGATE_CONTAINER_NAME =
      this.container.containerName;
    this.environmentVariables.SIX_GENERATION_JOB_FARGATE_SECURITY_GROUP =
      this.securityGroup.securityGroupId;
  }
}
