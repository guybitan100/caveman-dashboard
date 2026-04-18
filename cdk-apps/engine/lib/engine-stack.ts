import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { Datadog } from "./constructs/datadog";
import { TitanEnvironmentVariables } from "./types";
import * as path from "path";
import { GenerationStack } from "./stacks/generation/generation";
import { MetafinderStack } from "./stacks/metafinder/metafinder";
import { ApiStack } from "./stacks/api/api";
import { TablesStack } from "./stacks/tables/tables";
import { WebsocketStack } from "./stacks/websocket/websocket";
import { AiGenerationStack } from "./stacks/ai_generation/ai_generation";

interface EngineStackProps extends StackProps, EnvContext {}

interface InfraSSMOutputs {
  documentDBCredentialsSecretArn: string;
  documentDBClusterEndpoint: string;
}

export class EngineStack extends Stack {
  constructor(scope: Construct, id: string, props: EngineStackProps) {
    super(scope, id, props);

    const {
      version,
      vpcId,
      subnetIds,
      vpcEndpointId,
      jobsExpirationInDays,
      metafinderBucketName,
      datadogApiKeySecretArn,
      datadogForwarderArn,
      infraSSMParameter,
      engineSSMParameter,
      locationThumbnailPrefix,
      metafinderMetadataBucketName,
      domainName,
      certificateArn,
      eksClusterName,
      eksOidcProviderArn,
      eksOidcIssuerHostPath,
    } = props;
    const titanEnvironment = props.environment;

    const vpc = ec2.Vpc.fromLookup(this, "Vpc", {
      vpcId,
    });

    const subnets = subnetIds.map((subnetId) =>
      ec2.Subnet.fromSubnetId(this, subnetId, subnetId),
    );

    const jobsBucket = new s3.Bucket(this, "JobsBucket", {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        { expiration: cdk.Duration.days(jobsExpirationInDays), enabled: true },
      ],
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET],
          allowedHeaders: ["*"],
        },
      ],
    });

    const dynamodbPolicy = new iam.PolicyStatement({
      actions: ["dynamodb:*"],
      resources: ["*"],
    });

    const athenaFullAccess = iam.ManagedPolicy.fromManagedPolicyArn(
      this,
      "AmazonAthenaFullAccess",
      "arn:aws:iam::aws:policy/AmazonAthenaFullAccess",
    );

    //###########################
    //# Infra Stack SSM Outputs #
    //###########################
    // Retrieve the combined SSM parameter value
    const combinedInfraOutputs = ssm.StringParameter.valueFromLookup(
      this,
      infraSSMParameter,
    );

    const outputs = combinedInfraOutputs.startsWith("dummy-value")
      ? ({
          documentDBCredentialsSecretArn:
            "arn:aws:secretsmanager:eu-central-1:1234567890:secret:dummy2-iRDg5b",
        } as InfraSSMOutputs)
      : (JSON.parse(combinedInfraOutputs) as InfraSSMOutputs);
    console.log("Outputs: ", outputs);

    const docDbSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "DocDbSecret",
      outputs.documentDBCredentialsSecretArn,
    );

    const environment: TitanEnvironmentVariables = {
      SERVICE: "titan",
      TITAN_S3_TITAN_BUCKET_NAME: jobsBucket.bucketName,
      TITAN_DEPLOYMENT: "aws",
      TITAN_ENVIRONMENT: titanEnvironment,
      TITAN_AWS_REGION: this.region,
      TITAN_DB_DOCUMENT_DB_USER: docDbSecret
        .secretValueFromJson("username")
        .unsafeUnwrap()
        .toString(),
      TITAN_DB_DOCUMENT_DB_PASSWORD: docDbSecret
        .secretValueFromJson("password")
        .unsafeUnwrap()
        .toString(),
      TITAN_METAFINDER_S3_BUCKET_NAME: metafinderBucketName,
      TITAN_JOB_EXPIRY_DAYS: jobsExpirationInDays.toString(),
    };

    const dockerfile = path.join(__dirname, "../../..");

    const webSocketStack = new WebsocketStack(this, "WebsocketStack", {
      titanEnvironment,
    });

    environment.TITAN_WEBSOCKET_ENDPOINT = webSocketStack.endpoint;
    environment.TITAN_WEBSOCKET_API_KEY = webSocketStack.apiKey.attrApiKey;

    const metafinderStack = new MetafinderStack(this, "MetafinderStack", {
      vpc,
      subnets,
      dockerFilePath: dockerfile,
      athenaFullAccess,
      metafinderBucketName,
      metafinderMetadataBucketName,
      environment,
      vpcEndpointId,
    });

    const aiGenerationStack = new AiGenerationStack(this, "AiGenerationStack", {
      vpc,
      subnets,
      environment,
      dockerFilePath: dockerfile,
      domainName,
      certificateArn,
      eksClusterName,
      eksOidcProviderArn,
      eksOidcIssuerHostPath,
    });

    const generationStack = new GenerationStack(this, "GenerationStack", {
      vpc,
      dynamodbPolicy,
      environment: metafinderStack.environmentVariables,
      dockerFilePath: dockerfile,
      athenaFullAccess,
      metafinderDataBucket: metafinderStack.dataBucket,
      metafinderMetadataBucket: metafinderStack.metadataBucket,
      jobsBucket,
      subnets,
      locationThumbnailPrefix,
      websocketApiKey: webSocketStack.apiKey.attrApiKey,
      websocketEndpoint: webSocketStack.endpoint,
      eksClusterName,
      eksOidcProviderArn,
      eksOidcIssuerHostPath,
    });

    const apiStack = new ApiStack(this, "ApiStack", {
      vpc,
      subnets,
      dynamodbPolicy,
      dockerFilePath: dockerfile,
      metafinderMetadataBucketName,
      environment: generationStack.environmentVariables,
      vpcEndpointId,
    });

    generationStack.generateEntitiesFn.grantInvoke(apiStack.function);
    generationStack.createRandomJobFn.grantInvoke(apiStack.function);
    // Grant API Lambda permission to manage EKS jobs via kubernetes API
    apiStack.function.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["eks:DescribeCluster"],
        resources: ["*"],
      }),
    );
    metafinderStack.dataBucket.grantRead(apiStack.function);
    jobsBucket.grantReadWrite(apiStack.function);

    const dynamoTablesStack = new TablesStack(this, "DynamoTablesStack", {
      vpc,
      subnets,
      dockerFilePath: dockerfile,
      dynamodbPolicy,
      environment: apiStack.environmentVariables,
      titanEnvironment,
    });

    new Datadog(this, "Datadog", {
      service: "titan",
      functions: [
        dynamoTablesStack.createFn,
        dynamoTablesStack.deleteFn,
        metafinderStack.function,
        generationStack.createRandomJobFn,
        generationStack.generateEntitiesFn,
        apiStack.function,
      ],
      logGroups: [
        generationStack.logGroup,
        generationStack.genertaeLocationThumbnailFn.logGroup,
      ],
      environment: titanEnvironment,
      version,
      datadogApiKeySecretArn,
      datadogForwarderArn,
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: apiStack.url,
    });

    new cdk.CfnOutput(this, "MetafinderUrl", {
      value: metafinderStack.url,
    });

    new cdk.CfnOutput(this, "AiGenerationUrl", {
      value: aiGenerationStack.baseUrl,
    });

    //##################################################################
    // SSM Parameter Store
    //##################################################################

    // Combine the imported values into a single JSON object
    const combinedEngineOutputs = {
      apiUrl: apiStack.url,
      metafinderUrl: metafinderStack.url,
      aiGenerationUrl: aiGenerationStack.baseUrl,
      websocketEndpoint: webSocketStack.endpoint,
      websocketApiKey: webSocketStack.apiKey.attrApiKey,
    };

    // Push the combined values into a single SSM parameter
    new ssm.StringParameter(this, "EngineStackOutputs", {
      parameterName: `${engineSSMParameter}/${titanEnvironment}`,
      stringValue: JSON.stringify(combinedEngineOutputs),
      description: `Combined outputs from the engine stack for ${titanEnvironment}`,
    });
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface EnvContext {
  version: string;
  vpcId: string;
  subnetIds: string[];
  vpcEndpointId: string;
  jobsExpirationInDays: number;
  environment: string;
  metafinderBucketName: string;
  datadogApiKeySecretArn: string;
  datadogForwarderArn: string;
  infraSSMParameter: string;
  engineSSMParameter: string;
  locationThumbnailPrefix: string;
  metafinderMetadataBucketName: string;
  domainName: string;
  certificateArn: string;
  eksClusterName: string;
  eksOidcProviderArn: string;
  eksOidcIssuerHostPath: string;
}

interface EngineEnvProps extends StackProps {
  context: EnvContext;
}

export class EngineEnv extends Construct {
  constructor(scope: Construct, id: string, props: EngineEnvProps) {
    super(scope, id);

    const env = this.node.getContext("env") as string;
    console.log("Termination Protection: ", env === "prod");

    new EngineStack(this, "EngineStack", {
      env: props.env,
      terminationProtection: env === "prod", // Enable termination protection for prod environment
      ...props.context,
    });
  }
}
