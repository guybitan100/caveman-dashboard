import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { TitanEnvironmentVariables } from "../../types";

export interface ApiStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  subnets: ec2.ISubnet[];
  dockerFilePath: string;
  dynamodbPolicy: iam.PolicyStatement;
  metafinderMetadataBucketName: string;
  environment: TitanEnvironmentVariables;
  vpcEndpointId: string;
}

export class ApiStack extends cdk.NestedStack {
  public environmentVariables: TitanEnvironmentVariables;
  public function: lambda.DockerImageFunction;
  private apigateway: apigateway.LambdaRestApi;
  public url: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);

    const {
      vpc,
      subnets,
      dynamodbPolicy,
      dockerFilePath,
      environment,
      vpcEndpointId,
    } = props;
    this.environmentVariables = environment;

    this.function = new lambda.DockerImageFunction(this, "ApiFn", {
      code: lambda.DockerImageCode.fromImageAsset(dockerFilePath, {
        file: "./docker/api.lambda.Dockerfile",
      }),
      vpc,
      vpcSubnets: {
        subnets,
      },
      // @ts-expect-error - TitanEnvironmentVariables not compatible with Lambda function environment
      environment,
      timeout: cdk.Duration.minutes(15),
      memorySize: 10240,
      initialPolicy: [
        dynamodbPolicy,
        new iam.PolicyStatement({
          actions: ["ecs:*"],
          resources: ["*"],
        }),
      ],
    });

    this.apigateway = new apigateway.LambdaRestApi(this, "ApiApigateway", {
      handler: this.function,
      proxy: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          ...apigateway.Cors.DEFAULT_HEADERS,
          "Access-Control-Allow-Origin",
        ],
        allowCredentials: true,
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.PRIVATE],
        vpcEndpoints: [
          ec2.InterfaceVpcEndpoint.fromInterfaceVpcEndpointAttributes(
            this,
            "APIVpcEndpoint",
            {
              port: 443,
              vpcEndpointId,
            },
          ),
        ],
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*/*/*"],
            conditions: {
              StringEquals: {
                "aws:SourceVpce": vpcEndpointId,
              },
            },
          }),
        ],
      }),
    });

    this.url = `https://${this.apigateway.restApiId}-${vpcEndpointId}.execute-api.${cdk.Aws.REGION}.${cdk.Aws.URL_SUFFIX}/${this.apigateway.deploymentStage.stageName}`;
  }
}
