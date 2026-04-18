import * as cdk from "aws-cdk-lib";
import * as docdb from "aws-cdk-lib/aws-docdb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

export interface docDBProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  vpcSubnets: ec2.SubnetSelection;
  securityGroup: ec2.ISecurityGroup;
  ssmOutputsParameterName: string;
  r53Bucket: s3.Bucket;
}

export class docDB extends cdk.NestedStack {
  documentDBCredentialsSecretArn: string;
  documentDBCredentialsSecret: string;
  documentDBClusterReaderEndpoint: string;
  documentDBClusterEndpoint: string;
  constructor(scope: Construct, id: string, props: docDBProps) {
    super(scope, id, props);

    const { vpc, vpcSubnets, securityGroup, r53Bucket } = props;
    const docDbMasterUserSecret = new secretsmanager.Secret(
      this,
      "docDbMasterUserSecret",
      {
        secretName: "/six/docdb/masteruser",
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            username: "myAdmin",
          }),
          generateStringKey: "password",
          excludeCharacters: '"@\\:`|', // Exclude problematic characters
        },
      },
    );

    // DocumentDB Cluster
    const docDbClusterProps: docdb.DatabaseClusterProps = {
      masterUser: {
        username: docDbMasterUserSecret
          .secretValueFromJson("username")
          .unsafeUnwrap()
          .toString(),
        password: docDbMasterUserSecret.secretValueFromJson("password"),
      },
      instances: 1,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.R6G,
        ec2.InstanceSize.LARGE,
      ),
      storageType: docdb.StorageType.STANDARD,
      vpc: vpc,
      vpcSubnets: vpcSubnets,
      securityGroup: securityGroup,
      exportProfilerLogsToCloudWatch: true,
      exportAuditLogsToCloudWatch: true,
      cloudWatchLogsRetention: logs.RetentionDays.THREE_MONTHS,
      deletionProtection: true,
      copyTagsToSnapshot: true,
      enablePerformanceInsights: true, // Enable Performance Insights in all instances under this cluster
    };

    const docDbCluster = new docdb.DatabaseCluster(
      this,
      "docDbCluster",
      docDbClusterProps,
    );

    // Outputs
    new cdk.CfnOutput(this, "documentDBClusterEndpoint", {
      value: docDbCluster.clusterEndpoint.socketAddress,
      description: "The endpoint of the documentDB cluster",
      exportName: "documentDBClusterEndpoint",
    });
    new cdk.CfnOutput(this, "documentDBClusterReaderEndpoint", {
      value: docDbCluster.clusterReadEndpoint.socketAddress,
      description: "The reader endpoint of the documentDB cluster",
      exportName: "documentDBClusterReaderEndpoint",
    });
    new cdk.CfnOutput(this, "documentDBCredentialsSecret", {
      value:
        "https://console.aws.amazon.com/secretsmanager/home?region=" +
        this.region +
        "#/secret?name=" +
        docDbMasterUserSecret.secretName,
      description: "The URL of the documentDB master credentials secret",
      exportName: "documentDBCredentialsSecret",
    });
    new cdk.CfnOutput(this, "documentDBCredentialsSecretArn", {
      value: docDbMasterUserSecret.secretArn,
      description: "The ARN of the documentDB master credentials secret",
      exportName: "documentDBCredentialsSecretArn",
    });

    this.documentDBClusterEndpoint = docDbCluster.clusterEndpoint.socketAddress;
    this.documentDBClusterReaderEndpoint =
      docDbCluster.clusterReadEndpoint.socketAddress;
    this.documentDBCredentialsSecret = docDbMasterUserSecret.secretName;
    this.documentDBCredentialsSecretArn = docDbMasterUserSecret.secretArn;

    // Create the JSON data object
    const docDbRecord = s3deploy.Source.jsonData("docdb.json", {
      Changes: [
        {
          Action: "UPSERT",
          ResourceRecordSet: {
            Name: "docdb.ai.aws.cellebrite.local",
            Type: "CNAME",
            TTL: 300,
            ResourceRecords: [
              {
                Value: this.documentDBClusterEndpoint,
              },
            ],
          },
        },
      ],
    });

    const deployment = new s3deploy.BucketDeployment(
      this,
      "DeployDocDBRecord",
      {
        sources: [docDbRecord],
        destinationBucket: r53Bucket,
        prune: false,
      },
    );
    deployment.node.addDependency(docDbCluster);
  }
}
