import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface openSearchSnapshotLambdaStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class openSearchSnapshotLambdaStack extends cdk.NestedStack {
  snapshotLambda: lambda.Function;
  constructor(
    scope: Construct,
    id: string,
    props: openSearchSnapshotLambdaStackProps,
  ) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;
    const vpc = props?.vpc;
    const basePath = "migration";

    // References
    const snapshotBucketName = cdk.Fn.importValue(
      "OpenSearchSnapshotBucketName",
    );
    const openSearchClusterEndpoint = cdk.Fn.importValue("OpenSearchEndpoint");
    const masterUserSecretArn = cdk.Fn.importValue(
      "OpenSearchMasterUserSecretArn",
    );

    // TheSnapshotRole
    const backupBucket = s3.Bucket.fromBucketName(
      this,
      "BackupBucket",
      snapshotBucketName,
    );
    const snapshotRole = new iam.Role(this, "TheSnapshotRole", {
      assumedBy: new iam.ServicePrincipal("es.amazonaws.com"),
      description: "Role used by OpenSearch to access S3 for snapshots",
    });
    snapshotRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [backupBucket.bucketArn],
      }),
    );
    snapshotRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [`${backupBucket.bucketArn}/*`],
      }),
    );

    const masterUserSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "OpenSearchMasterSecret",
      masterUserSecretArn,
    );

    // Create the Lambda function
    this.snapshotLambda = new lambda.Function(this, "SnapshotLambda", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "lambda_function.lambda_handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./assets/my-archive.zip"),
      ),
      vpc,
      timeout: cdk.Duration.minutes(1),
      environment: {
        OPENSEARCH_URL: openSearchClusterEndpoint,
        SECRET_ARN: masterUserSecretArn,
        SNAPSHOT_ROLE_ARN: snapshotRole.roleArn,
        S3_BUCKET_NAME: snapshotBucketName,
        BASE_PATH: basePath,
        REGION: region,
        S3_ENDPOINT: "s3." + region + ".amazonaws.com",
      },
    });

    // Permissions
    masterUserSecret.grantRead(this.snapshotLambda);
    this.snapshotLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "es:ESHttp*",
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
        ],
        resources: ["*"],
      }),
    );
    this.snapshotLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [snapshotRole.roleArn],
      }),
    );

    // Outputs
    new cdk.CfnOutput(this, "SnapshotRoleArn", {
      value: snapshotRole.roleArn,
      description: "The ARN of the role to be used by OpenSearch for snapshots",
    });
  }
}
