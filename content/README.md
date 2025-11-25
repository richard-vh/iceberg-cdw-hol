# Open Data Lakehouse - Apache Iceberg Features and Management

This document explores some of the core features of Apache Iceberg, including table creation, data insertion, schema evolution, and time travel.

## Table of Contents

1.  [Creating Iceberg Tables](#1-creating-iceberg-tables)
2.  [Understanding Iceberg Storage](#2-understanding-iceberg-storage)
3.  [Inserts, Updates, and Deletes](#3-inserts-updates-and-deletes)
4.  [Iceberg Table Types (COW and MOR)](#4-iceberg-table-types-cow-and-mor)
7.  [Schema and Partition Evolution](#5-schema-and-partition-evolution)
8.  [Time Travel and Rollbacks](#6-time-travel-and-rollbacks)
9.  [Branching and Merging](#7-branching-and-merging)
10. [Tagging (Versioning)](#8-tagging-versioning)
11. [Table Migration](#9-table-migration)
12. [Table Maintenance](#10-table-maintenance)
13. [Useful Links](#11-useful-links)

---

## 1. Creating Iceberg Tables

### What is an Iceberg table?

An **Iceberg Table** is a table where Iceberg manages both the metadata and the data itself. It is a fully integrated table that Iceberg can track and manage. When you drop an Iceberg Table, both the metadata and the data are removed.

### Use an Iceberg Table when:
*   You need Iceberg to fully handle both the data and metadata.
*   You want to manage the entire lifecycle of the table automatically.
*   You require atomic operations, such as partition evolution, schema evolution, and time travel.

### Key Benefits and Limitations

**Benefits:** 
- Simplified data management.
- Automatic metadata handling.
- Built-in features like time travel and schema evolution.

**Limitations:** 
- Dropping the table automatically deletes all data.


!!! note
    By default, when creating an Iceberg table, it will be a **Copy-on-Write (COW)** table. You can explicitly specify the table type as Copy-on-Write (COW) or Merge-on-Write (MOR) using table properties.

### Table Creation Example

!!! type "Impala"
```sql
-- Drop the table if it exists
DROP TABLE IF EXISTS default.managed_countries;

-- Create the table in Impala
CREATE TABLE default.managed_countries (
country_code STRING,
country_name STRING,
population INT,
area DOUBLE
) STORED AS ICEBERG;

-- Insert data into the table
INSERT INTO default.managed_countries VALUES
('FR', 'France', 67391582, 643801.0),
('DE', 'Germany', 83149300, 357022.0),
('IT', 'Italy', 60262770, 301340.0);

-- Read data from the table
SELECT * FROM default.managed_countries;

-- Describe the table to show its schema
DESCRIBE FORMATTED default.managed_countries;

-- Show the table's creation script
SHOW CREATE TABLE default.managed_countries;
```

## 2. Understanding Iceberg Storage

### Iceberg Table Definition and Metadata
The `SHOW CREATE TABLE` command confirms the Iceberg table's definition. Checking the HDFS location reveals that Iceberg manages both data (`data/`) and metadata (`metadata/`) directories within the table's storage path.

- **metadata/** contains snapshots, schema history, and manifest files.
- **data/** contains the actual table data files.

Iceberg uses the **metadata/** directory to manage partitioning and versioning, without relying on Hive Metastore. The **data/** directory contains the actual table data files.

### Code Example

```
-- Get the Iceberg table definition
spark.sql("SHOW CREATE TABLE default.managed_countries").show(truncate=False)
```

```
# Check the Object Store directory for Iceberg metadata and data
[jturkington@XYZ-es01 ~]$ hdfs dfs -ls s3a://.../external/hive/default.db/managed_countries/metadata
```

```
-rw-r--r--   3 jturkington hive       1710 2025-02-05 12:55 hdfs://.../external/hive/default.db/managed_countries/metadata/00000-bc161db1-05f2-4d64-baab-69ca2070db33.metadata.json
-rw-r--r--   3 jturkington hive       6072 2025-02-05 04:05 hdfs://.../external/hive/default.db/managed_countries/metadata/3ecfea4f-9e06-45a9-bd7c-430fe4758283-m0.avro
-rw-r--r--   3 jturkington hive       3800 2025-02-05 12:55 hdfs://.../external/hive/default.db/managed_countries/metadata/snap-1185275548636187694-1-f7f549e1-bd07-44da-b170-8973c2e6e3d6.avro
```

### Understanding the Metadata Files
Iceberg uses several types of metadata files to track table state and manage its partitions. Below are the types of metadata files found in the metadata/ directory.

#### <ins>Metadata JSON Files (*.metadata.json)</ins>
**Example Files:**
00000-bc161db1-05f2-4d64-baab-69ca2070db33.metadata.json

**Purpose:** Stores table-level metadata such as schema, partitioning, snapshots, and file references. Each time the table structure changes (e.g., schema evolution, snapshot creation), a new metadata JSON file is generated. Older metadata files are retained to support time travel and rollback.
**Data Type:** JSON format (human-readable, structured key-value pairs).
**Why?** JSON allows Iceberg to store metadata in a flexible, easily accessible format. New versions can be created without modifying existing files, enabling schema evolution.

#### <ins>Manifest List Files (*-m0.avro)</ins>
**Example Files:**
3ecfea4f-9e06-45a9-bd7c-430fe4758283-m0.avro

**Purpose:** Stores a list of manifest files associated with a snapshot. Helps Iceberg quickly determine which data files belong to which snapshot without scanning the entire table.
**Data Type:** Apache Avro format (binary, optimized for fast read/write).
**Why?** Avro is compact and supports schema evolution, making it ideal for metadata storage. Using Avro instead of JSON for large metadata speeds up querying and file tracking.

#### <ins>Snapshot Files (snap--.avro)</ins>
**Example Files:**
snap-1185275548636187694-1-f7f549e1-bd07-44da-b170-8973c2e6e3d6.avro

**Purpose:** Tracks table state at a specific point in time (snapshot ID, timestamp, manifest list, etc.). Allows for time travel and rollbacks to previous versions of the table.
**Data Type:** Apache Avro format (binary, optimized for structured data storage).
**Why?** Storing snapshots in Avro provides efficient serialization while keeping metadata compact and performant. Enables fast lookup of previous states for Iceberg’s time travel feature.

### How These Files Work Together in Iceberg

**Metadata JSON file** (.metadata.json) defines the table schema and references snapshots.

**Snapshot file** (snap-*.avro) records changes and links to manifest lists.

**Manifest list file** (*-m0.avro) references manifest files that contain details of individual data files.

These components work together to support partitioning, versioning, and time travel, allowing Iceberg to provide robust table management with features like schema evolution and data consistency.
