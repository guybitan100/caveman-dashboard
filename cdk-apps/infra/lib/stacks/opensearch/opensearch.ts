import * as cdk from "aws-cdk-lib";
import { RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as opensearchservice from "aws-cdk-lib/aws-opensearchservice";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

export interface openSearchProps extends cdk.StackProps {
  vpc?: ec2.IVpc;
  vpcSubnets?: ec2.SubnetSelection[];
  securityGroups?: ec2.ISecurityGroup[];
  openSearchDomainName?: string;
  domainCertificateArn?: string;
  ssmOutputsParameterName: string;
  r53Bucket: s3.Bucket;
}

export class openSearch extends cdk.NestedStack {
  openSearchDomainEndpoint: string;
  openSearchDomainArn: string;
  openSearchMasterUserSecret: string;
  openSearchMasterUserSecretArn: string;
  constructor(scope: Construct, id: string, props: openSearchProps) {
    super(scope, id, props);

    const {
      vpc,
      vpcSubnets,
      securityGroups,
      openSearchDomainName,
      domainCertificateArn,
      r53Bucket,
    } = props;
    const openSearchMasterSecret = new secretsmanager.Secret(
      this,
      "openSearchMasterSecret",
      {
        secretName: "/six/opensearch/masteruser",
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username: "admin" }),
          generateStringKey: "password",
        },
      },
    );

    // OpenSearch Cluster
    const openSearchClusterProps: opensearchservice.DomainProps = {
      version: opensearchservice.EngineVersion.OPENSEARCH_2_17,
      enableVersionUpgrade: false,
      enableAutoSoftwareUpdate: false,
      vpc: vpc,
      vpcSubnets: vpcSubnets,
      securityGroups: securityGroups,
      ipAddressType: opensearchservice.IpAddressType.IPV4,
      removalPolicy: RemovalPolicy.RETAIN,
      capacity: {
        multiAzWithStandbyEnabled: false,
        masterNodes: 0,
        masterNodeInstanceType: "c5.large.search",
        dataNodes: 1,
        dataNodeInstanceType: "c5.2xlarge.search",
      },
      ebs: {
        volumeSize: 30,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
        throughput: 125,
        iops: 3000,
      },
      zoneAwareness: {
        enabled: false,
      },
      logging: {
        slowSearchLogEnabled: true,
        appLogEnabled: true,
        slowIndexLogEnabled: true,
      },
      enforceHttps: true,
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      fineGrainedAccessControl: {
        masterUserName: openSearchMasterSecret
          .secretValueFromJson("username")
          .unsafeUnwrap()
          .toString(),
        masterUserPassword:
          openSearchMasterSecret.secretValueFromJson("password"),
      },
      customEndpoint: {
        domainName: openSearchDomainName!,
        certificate: acm.Certificate.fromCertificateArn(
          this,
          "Certificate",
          domainCertificateArn!,
        ),
      },
    };

    // Outputs
    const openSearchCluster = new opensearchservice.Domain(
      this,
      "openSearchCluster",
      openSearchClusterProps,
    );

    openSearchCluster.addAccessPolicies(
      new iam.PolicyStatement({
        actions: ["es:*"],
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        resources: [
          openSearchCluster.domainArn,
          `${openSearchCluster.domainArn}/*`,
        ],
      }),
    );

    // Grant Read/Write Access
    openSearchCluster.grantReadWrite(new iam.AnyPrincipal());

    new cdk.CfnOutput(this, "OpenSearchDomainEndpoint", {
      value: openSearchCluster.domainEndpoint,
      description: "The endpoint of the OpenSearch cluster",
      exportName: "OpenSearchEndpoint",
    });

    new cdk.CfnOutput(this, "OpenSearchDomainArn", {
      value: openSearchCluster.domainArn,
      description: "The ARN of the OpenSearch cluster",
      exportName: "OpenSearchDomainArn",
    });

    new cdk.CfnOutput(this, "OpenSearchMasterUserSecret", {
      value:
        "https://console.aws.amazon.com/secretsmanager/home?region=" +
        this.region +
        "#/secret?name=" +
        openSearchMasterSecret.secretName,
      description: "The URL of the OpenSearch master credentials secret",
      exportName: "OpenSearchMasterUserSecret",
    });

    new cdk.CfnOutput(this, "OpenSearchMasterUserSecretArn", {
      value: openSearchMasterSecret.secretArn,
      description: "The ARN of the OpenSearch master credentials secret",
      exportName: "OpenSearchMasterUserSecretArn",
    });
    this.openSearchDomainEndpoint = openSearchCluster.domainEndpoint;
    this.openSearchDomainArn = openSearchCluster.domainArn;
    this.openSearchMasterUserSecret = openSearchMasterSecret.secretName;
    this.openSearchMasterUserSecretArn = openSearchMasterSecret.secretArn;

    const openSearchRecord = s3deploy.Source.jsonData("opensearch.json", {
      Changes: [
        {
          Action: "UPSERT",
          ResourceRecordSet: {
            Name: "opensearch.ai.aws.cellebrite.local",
            Type: "CNAME",
            TTL: 300,
            ResourceRecords: [
              {
                Value: this.openSearchDomainEndpoint,
              },
            ],
          },
        },
      ],
    });

    // Deploy the file to the S3 bucket - This will trigger a lambda to update the Route53 records
    const deployment = new s3deploy.BucketDeployment(this, "DeployOSRecord", {
      sources: [openSearchRecord],
      destinationBucket: r53Bucket,
      prune: false,
    });
    deployment.node.addDependency(openSearchCluster);
  }
}
