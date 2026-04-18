import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { SixEnvironmentVariables } from "../../types";

export interface MetafinderStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  subnets: ec2.ISubnet[];
  dockerFilePath: string;
  athenaFullAccess: iam.IManagedPolicy;
  metafinderBucketName: string;
  metafinderMetadataBucketName: string;
  environment: SixEnvironmentVariables;
  vpcEndpointId: string;
}

export class MetafinderStack extends cdk.NestedStack {
  public dataBucket: s3.IBucket;
  public metadataBucket: s3.IBucket;
  public environmentVariables: SixEnvironmentVariables;
  public function: lambda.DockerImageFunction;
  private apigateway: apigateway.LambdaRestApi;
  public url: string;

  constructor(scope: Construct, id: string, props: MetafinderStackProps) {
    super(scope, id);

    const {
      vpc,
      subnets,
      athenaFullAccess,
      dockerFilePath,
      metafinderBucketName,
      metafinderMetadataBucketName,
      environment,
      vpcEndpointId,
    } = props;
    this.environmentVariables = environment;

    this.dataBucket = s3.Bucket.fromBucketName(
      this,
      "MetafinderBucket",
      metafinderBucketName,
    );

    this.metadataBucket = s3.Bucket.fromBucketName(
      this,
      "MetafinderMetadataBucket",
      metafinderMetadataBucketName,
    );

    this.function = new lambda.DockerImageFunction(this, "MetafinderFn", {
      code: lambda.DockerImageCode.fromImageAsset(dockerFilePath, {
        file: "./docker/metafinder.lambda.Dockerfile",
      }),
      vpc,
      vpcSubnets: {
        subnets,
      },
      // @ts-expect-error - SixEnvironmentVariables not compatible with Lambda function environment
      environment,
      timeout: cdk.Duration.minutes(15),
      memorySize: 10240,
    });

    this.function.role?.addManagedPolicy(athenaFullAccess);
    this.metadataBucket.grantReadWrite(this.function);
    this.dataBucket.grantRead(this.function);

    this.apigateway = new apigateway.LambdaRestApi(
      this,
      "MetafinderApigateway",
      {
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
              "MetafinderVpcEndpoint",
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
      },
    );

    this.url = `https://${this.apigateway.restApiId}-${vpcEndpointId}.execute-api.${cdk.Aws.REGION}.${cdk.Aws.URL_SUFFIX}/${this.apigateway.deploymentStage.stageName}`;
    this.environmentVariables.SIX_METAFINDER_HOST = this.url;
  }
}
