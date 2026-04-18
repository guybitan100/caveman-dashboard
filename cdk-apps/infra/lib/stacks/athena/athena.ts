import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as glue from "@aws-cdk/aws-glue-alpha";
import { Construct } from "constructs";
import { GlueTableConstruct } from "../../constructs/glueTsvTable";

export interface AthenaStackProps extends cdk.StackProps {
  metafinderMetadataBucketName: string;
}

export class Athena extends cdk.NestedStack {
  database: glue.Database;
  indexesPrefix = "jsonl_indexes";
  constructor(scope: Construct, id: string, props: AthenaStackProps) {
    super(scope, id, props);

    const { metafinderMetadataBucketName } = props;

    this.database = new glue.Database(this, "MetafinderDatabase", {
      databaseName: "metafinder",
    });

    const metafinderMetadataBucket = s3.Bucket.fromBucketName(
      this,
      "MetafinderMetadataBucket",
      metafinderMetadataBucketName,
    );

    // Tables

    new GlueTableConstruct(this, "ImageIndexV2", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "image_index_v2",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "format", type: glue.Schema.STRING },
        { name: "size", type: glue.Schema.INTEGER },
        { name: "s3_key", type: glue.Schema.STRING },
        {
          name: "categories",
          type: glue.Schema.array(glue.Schema.STRING),
        },
        { name: "width", type: glue.Schema.INTEGER },
        { name: "height", type: glue.Schema.INTEGER },
      ],
    });

    new GlueTableConstruct(this, "AppsIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "apps_index",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "app_id", type: glue.Schema.STRING },
        { name: "name", type: glue.Schema.STRING },
        { name: "os", type: glue.Schema.STRING },
        {
          name: "category",
          type: glue.Schema.array(glue.Schema.STRING),
        },
        {
          name: "event_types",
          type: glue.Schema.array(glue.Schema.STRING),
        },
        { name: "icon", type: glue.Schema.STRING },
      ],
    });

    new GlueTableConstruct(this, "AudioIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "audio_index_v2",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "format", type: glue.Schema.STRING },
        { name: "size", type: glue.Schema.INTEGER },
        { name: "s3_key", type: glue.Schema.STRING },
        {
          name: "categories",
          type: glue.Schema.array(glue.Schema.STRING),
        },
        { name: "duration", type: glue.Schema.INTEGER },
      ],
    });

    new GlueTableConstruct(this, "EntitiesIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "entity_index",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "first_name", type: glue.Schema.STRING },
        { name: "last_name", type: glue.Schema.STRING },
        { name: "phone", type: glue.Schema.STRING },
        { name: "gender", type: glue.Schema.STRING },
        { name: "country", type: glue.Schema.STRING },
        { name: "ip_address", type: glue.Schema.STRING },
        { name: "email", type: glue.Schema.STRING },
      ],
    });

    new GlueTableConstruct(this, "FieldsIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "fields_index",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "version", type: glue.Schema.STRING },
        { name: "model_type", type: glue.Schema.STRING },
        { name: "field_type", type: glue.Schema.STRING },
        { name: "name", type: glue.Schema.STRING },
        { name: "value_type", type: glue.Schema.STRING },
        { name: "is_sub_field", type: glue.Schema.BOOLEAN },
        { name: "multi_model_types", type: glue.Schema.STRING },
        { name: "values", type: glue.Schema.STRING },
      ],
    });

    new GlueTableConstruct(this, "FilesIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "files_index",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "s3_key", type: glue.Schema.STRING },
        { name: "format", type: glue.Schema.STRING },
        { name: "file_size", type: glue.Schema.INTEGER },
        { name: "size", type: glue.Schema.INTEGER },
      ],
    });

    new GlueTableConstruct(this, "TextIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "text_index",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "text", type: glue.Schema.STRING },
        { name: "size", type: glue.Schema.INTEGER },
      ],
    });

    new GlueTableConstruct(this, "UrlsIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "urls_index",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "url", type: glue.Schema.STRING },
        {
          name: "categories",
          type: glue.Schema.array(glue.Schema.STRING),
        },
        { name: "cctld", type: glue.Schema.STRING },
      ],
    });

    new GlueTableConstruct(this, "VideoIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "video_index_v2",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "format", type: glue.Schema.STRING },
        { name: "size", type: glue.Schema.INTEGER },
        { name: "s3_key", type: glue.Schema.STRING },
        {
          name: "categories",
          type: glue.Schema.array(glue.Schema.STRING),
        },
        { name: "duration", type: glue.Schema.INTEGER },
      ],
    });

    new GlueTableConstruct(this, "ChatsIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "chats_index",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        {
          name: "categories",
          type: glue.Schema.array(glue.Schema.STRING),
        },
        { name: "word_count", type: glue.Schema.INTEGER },
        { name: "size", type: glue.Schema.INTEGER },
        { name: "language", type: glue.Schema.STRING },
        { name: "text", type: glue.Schema.STRING },
      ],
    });

    new GlueTableConstruct(this, "CellTowerIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "cell-towers",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "area", type: glue.Schema.BIG_INT },
        { name: "cell", type: glue.Schema.BIG_INT },
        { name: "mcc", type: glue.Schema.BIG_INT },
        { name: "net", type: glue.Schema.BIG_INT },
        { name: "radio", type: glue.Schema.STRING },
        { name: "range", type: glue.Schema.BIG_INT },
        {
          name: "location",
          type: glue.Schema.struct([
            { name: "lat", type: glue.Schema.DOUBLE },
            { name: "lon", type: glue.Schema.DOUBLE },
          ]),
        },
      ],
    });

    new GlueTableConstruct(this, "LocaliezedNameIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "name_index",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "alphabet", type: glue.Schema.STRING },
        { name: "country_code", type: glue.Schema.STRING },
        { name: "is_surname", type: glue.Schema.BOOLEAN },
        { name: "male_prob", type: glue.Schema.FLOAT },
        { name: "name", type: glue.Schema.STRING },
      ],
    });

    new GlueTableConstruct(this, "CryptoIndex", {
      database: this.database,
      bucket: metafinderMetadataBucket,
      dataPrefix: this.indexesPrefix,
      tableName: "crypto_index",
      columns: [
        { name: "id", type: glue.Schema.STRING },
        { name: "coin", type: glue.Schema.STRING },
        { name: "language", type: glue.Schema.STRING },
        { name: "type", type: glue.Schema.STRING },
        { name: "value", type: glue.Schema.STRING },
      ],
    });
  }
}
