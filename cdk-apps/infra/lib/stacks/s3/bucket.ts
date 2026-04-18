import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";

export interface openSearchSnapshotS3StackProps extends NestedStackProps {
  bucketName: string;
}

export class openSearchSnapshotS3Stack extends NestedStack {
  OpenSearchSnapshotBucketName: string;
  OpenSearchSnapshotBucketArn: string;
  constructor(
    scope: Construct,
    id: string,
    props: openSearchSnapshotS3StackProps,
  ) {
    super(scope, id, props);

    let snapshotBucket: s3.IBucket;
    const bucketName = props.bucketName;

    try {
      snapshotBucket = s3.Bucket.fromBucketName(
        this,
        "OpenSearchSnapshotBucket",
        bucketName,
      );
    } catch {
      snapshotBucket = new s3.Bucket(this, "OpenSearchSnapshotBucket", {
        bucketName: bucketName,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        versioned: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      });
    }

    //   // Outputs
    //   new cdk.CfnOutput(this, "SnapshotBucketName", {
    //     value: snapshotBucket.bucketName,
    //     exportName: "OpenSearchSnapshotBucketName",
    //     description: "The name of the S3 bucket used for OpenSearch snapshots",
    //   });
    //   new cdk.CfnOutput(this, "SnapshotBucketArn", {
    //     value: snapshotBucket.bucketArn,
    //     exportName: "OpenSearchSnapshotBucketArn",
    //     description: "The ARN of the S3 bucket used for OpenSearch snapshots",
    //   });
    this.OpenSearchSnapshotBucketName = snapshotBucket.bucketName;
    this.OpenSearchSnapshotBucketArn = snapshotBucket.bucketArn;
  }
}
