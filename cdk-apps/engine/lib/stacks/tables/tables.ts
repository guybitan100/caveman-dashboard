import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { SixEnvironmentVariables } from "../../types";

export interface TablesStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  subnets: ec2.ISubnet[];
  dockerFilePath: string;
  dynamodbPolicy: iam.PolicyStatement;
  environment: SixEnvironmentVariables;
  sixEnvironment: string;
}

export class TablesStack extends cdk.NestedStack {
  public createFn: lambda.DockerImageFunction;
  public deleteFn: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: TablesStackProps) {
    super(scope, id);

    const {
      vpc,
      subnets,
      dynamodbPolicy,
      dockerFilePath,
      environment,
      sixEnvironment,
    } = props;

    this.createFn = new lambda.DockerImageFunction(this, "CreateTablesFn", {
      code: lambda.DockerImageCode.fromImageAsset(dockerFilePath, {
        file: "./docker/api.lambda.Dockerfile",
        cmd: ["api.handler.startup_handler"],
      }),
      vpc,
      vpcSubnets: {
        subnets,
      },
      // @ts-expect-error - SixEnvironmentVariables not compatible with Lambda function environment
      environment,
      timeout: cdk.Duration.minutes(15),
      memorySize: 10240,
      initialPolicy: [dynamodbPolicy],
    });

    this.deleteFn = new lambda.DockerImageFunction(this, "DeleteTablesFn", {
      code: lambda.DockerImageCode.fromImageAsset(dockerFilePath, {
        file: "./docker/api.lambda.Dockerfile",
        cmd: ["api.handler.shutdown_handler"],
      }),
      vpc,
      vpcSubnets: {
        subnets,
      },
      // @ts-expect-error - SixEnvironmentVariables not compatible with Lambda function environment
      environment,
      timeout: cdk.Duration.minutes(15),
      memorySize: 10240,
      initialPolicy: [dynamodbPolicy],
    });

    new cr.AwsCustomResource(this, "HandleTablesCustomResource", {
      onCreate: {
        service: "Lambda",
        action: "invoke",
        parameters: {
          FunctionName: this.createFn.functionName,
          Environment: sixEnvironment,
        },
        physicalResourceId: cr.PhysicalResourceId.of("CreateTablesFn"),
      },
      onDelete: {
        service: "Lambda",
        action: "invoke",
        parameters: {
          FunctionName: this.deleteFn.functionName,
          Environment: sixEnvironment,
        },
        physicalResourceId: cr.PhysicalResourceId.of("DeleteTablesFn"),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["lambda:InvokeFunction"],
          resources: [this.createFn.functionArn, this.deleteFn.functionArn],
        }),
      ]),
    });
  }
}
