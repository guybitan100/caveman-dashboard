import * as cdk from "aws-cdk-lib";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";

interface r53StackProps extends NestedStackProps {
  vpc: ec2.IVpc;
  roleArn: string;
  hostedZoneId: string;
}

export class r53Stack extends NestedStack {
  LambdaFn: lambda.Function;
  r53Bucket: s3.Bucket;
  constructor(scope: Construct, id: string, props: r53StackProps) {
    super(scope, id, props);

    const { vpc, roleArn, hostedZoneId } = props;

    const r53Bucket = new s3.Bucket(this, "r53Bucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const r53Lambda = new lambda.Function(this, "r53LambdaFunction", {
      runtime: lambda.Runtime.PYTHON_3_13,
      code: lambda.Code.fromAsset(path.join(__dirname, "manage-records")),
      handler: "main.lambda_handler",
      timeout: cdk.Duration.seconds(30),
      environment: {
        ROLE_ARN: roleArn,
        HOSTED_ZONE_ID: hostedZoneId,
      },
      vpc: vpc,
    });

    const assumeRolePolicy = new iam.PolicyStatement({
      actions: ["sts:AssumeRole"],
      resources: [roleArn],
    });

    r53Lambda.addToRolePolicy(assumeRolePolicy);
    r53Bucket.grantRead(r53Lambda);
    r53Bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(r53Lambda),
    );
    r53Lambda.addPermission("S3InvokePermission", {
      principal: new iam.ServicePrincipal("s3.amazonaws.com"),
      sourceArn: r53Bucket.bucketArn,
    });
    new cdk.CfnOutput(this, "r53BucketName", {
      value: r53Bucket.bucketName,
      exportName: "r53BucketName",
      description: "The name of the S3 bucket used for Route 53",
    });
    this.LambdaFn = r53Lambda;
    this.r53Bucket = r53Bucket;
  }
}
