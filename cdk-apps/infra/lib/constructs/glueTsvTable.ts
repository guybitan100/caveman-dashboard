import * as s3 from "aws-cdk-lib/aws-s3";
import * as glue from "@aws-cdk/aws-glue-alpha";
import { Construct } from "constructs";

interface GlueTableProps {
  database: glue.IDatabase;
  bucket: s3.IBucket;
  dataPrefix: string;
  tableName: string;
  columns: glue.Column[];
}

export class GlueTableConstruct extends Construct {
  constructor(scope: Construct, id: string, props: GlueTableProps) {
    super(scope, id);

    const { database, bucket, dataPrefix, tableName, columns } = props;

    new glue.S3Table(this, `${id}Table`, {
      database,
      bucket,
      s3Prefix: `${dataPrefix}/${tableName}/`,
      tableName,
      columns,
      dataFormat: glue.DataFormat.JSON,
    });
  }
}
