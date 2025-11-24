This document has been converted into a GitHub `README.md` file format, summarizing the features and management capabilities of Apache Iceberg based on the provided source material.

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

An **Iceberg Table** is a table where Iceberg manages both the metadata and the data itself. It is a fully integrated table that Iceberg can track and manage. When you drop an Iceberg Table, both the metadata and the data are removed.

**Use an Iceberg Table when:**
*   You need Iceberg to fully handle both the data and metadata.
*   You want to manage the entire lifecycle of the table automatically.
*   You require atomic operations, such as partition evolution, schema evolution, and time travel.

### Key Benefits and Limitations

| Aspect | Details | Source |
| :--- | :--- | :--- |
| **Benefits** | Simplified data management, automatic metadata handling, and built-in features like time travel and schema evolution. | |
| **Limitations** | Dropping the table automatically deletes all data. | |

**Note:** By default, when creating an Iceberg table, it will be a **Copy-on-Write (COW)** table. You can explicitly specify the table type as Copy-on-Write (COW) or Merge-on-Write (MOR) using table properties.

### Table Creation Example

#### IMPALA

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

## 2. Iceberg Table Types (COW and MOR)

Iceberg tables support different storage strategies to balance performance, storage efficiency, and query speed.

### Iceberg Copy-on-Write (COW) Table

**What is it?**
A Copy-on-Write (COW) table creates a new version of the data on each modification, and the old data is not overwritten.

**Key Features:**
*   Ensures immutability.
*   Ideal for ACID transaction support.
*   Suitable for batch jobs where data doesn't change frequently.
*   Old versions of data can be retained for audit purposes.
*   Iceberg is **Copy-on-Write (COW) by default**.

### Iceberg Merge-on-Read (MOR) Table

**What is it?**
Merge-on-Read (MOR) tables store changes as **delta files** instead of rewriting entire data files, optimizing write performance. These delta files are merged at query time.

**Key Use Cases:**
*   Real-time ingestion of frequently updated data.
*   Event-driven architectures where append operations dominate.
*   Optimized for streaming workloads, reducing write latency while maintaining historical changes.

**How to create an MOR Table (SPARK):**

```sql
# CREATE ICEBERG MERGE-ON-READ TABLE
spark.sql("""
CREATE TABLE default.mor_european_countries (
country_code STRING,
country_name STRING,
population BIGINT,
area_km2 DOUBLE,
last_updated TIMESTAMP
)
USING iceberg
TBLPROPERTIES (
'format-version'='2',
'write.format.default'='parquet',
'write.delete.mode'='merge-on-read',
'write.update.mode'='merge-on-read',
'write.merge.mode'='merge-on-read'
)
""")
```

## 3. Inserts, Updates, and Deletes

In Iceberg, data manipulation (insertions, updates, deletions) is performed using standard SQL commands.

### Inserting & Updating Data

Updates modify existing records based on a condition.

**Best Practices:**
*   Ensure the schema is well-defined.
*   Perform updates only when necessary to avoid frequent schema changes.
*   Monitor table performance as data grows, especially with large updates.

**Example Update (SPARK):**
```sql
# Updating data for a football team
spark.sql("""
UPDATE default.english_football_teams
SET team_stadium = 'New Stamford Bridge'
WHERE team_id = 'T003'
""")
```

### Handling Data Deletions

Iceberg uses a **snapshot mechanism**, so deletions add a new snapshot but do not immediately remove the physical data. This ensures that deleted data can still be recovered.

**Considerations:**
*   Deletions are versioned and can be reverted through time travel.
*   You can configure Iceberg to perform data compaction after deletion for performance optimization.

**Example Deletion (SPARK):**
```sql
# Deleting data from the table (removing Chelsea)
spark.sql("""
DELETE FROM default.english_football_teams
WHERE team_id = 'T003'
""")
```

## 4. Understanding Iceberg Storage and Metadata

Iceberg manages both data and metadata directories within the table's storage path.

*   **`data/`:** Contains the actual table data files.
*   **`metadata/`:** Contains snapshots, schema history, and manifest files.

Iceberg manages partitioning and versioning using the `metadata/` directory, without relying on Hive Metastore.

### Understanding the Metadata Files

Iceberg uses several types of metadata files to track table state and manage partitions:

| File Type | Format/Data Type | Purpose |
| :--- | :--- | :--- |
| **Metadata JSON Files** (`*.metadata.json`) | JSON (human-readable) | Stores table-level metadata such as schema, partitioning, snapshots, and file references. A new file is generated each time the table structure changes, retaining older files for time travel and rollback. |
| **Manifest List Files** (`*-m0.avro`) | Apache Avro (binary) | Stores a list of manifest files associated with a snapshot, helping Iceberg quickly determine which data files belong to which snapshot. Avro is used for compaction and efficient file tracking. |
| **Snapshot Files** (`snap-*.avro`) | Apache Avro (binary) | Tracks table state at a specific point in time (snapshot ID, timestamp, manifest list, etc.). Enables fast lookup of previous states for Iceberg’s time travel feature. |

These files work together: the Metadata JSON file defines the schema and references snapshots; Snapshot files link to manifest lists; and Manifest list files reference manifest files detailing individual data files.

## 5. Schema and Partition Evolution

### Schema Evolution in Iceberg

Schema evolution allows you to modify table structures over time while ensuring historical data remains accessible without requiring a full table rewrite.

**Schema Evolution Operations include:**
*   Adding new columns.
*   Renaming existing columns.
*   Changing column types (if compatible).
*   Dropping columns.

Schema evolution is important for adapting to business needs, maintaining backwards compatibility, and simplifying data management by allowing incremental changes.

**Example Schema Evolution (SPARK):**

```sql
# Add a new column to the table
spark.sql("""
ALTER TABLE default.zoo_animals_schema_evo ADD COLUMN habitat STRING
""")

# Rename an existing column
spark.sql("""
ALTER TABLE default.zoo_animals_schema_evo RENAME COLUMN animal_name TO species_name
""")
```

### Partition Evolution

Partition evolution is the ability to modify the partitioning strategy of an Iceberg table after its creation, such as changing the partitioning key or adding new partitioning columns. This is unlike traditional partitioning schemes because it allows flexible evolution without needing to rewrite the entire dataset.

**Partition Management Strategies:**
*   Time-based partitioning for time-series data.
*   Range or hash partitioning for balancing data across partitions.
*   The partitioning strategy can be changed after the table has been created, even if data already exists.

**Example Partition Evolution (SPARK):**

```sql
# Create the initial Iceberg table partitioned by 'animal_id'
CREATE TABLE default.zoo_animals_partition_evo (
animal_id STRING,
species_name STRING,
habitat STRING
)
USING iceberg
PARTITIONED BY (animal_id)

# Change the partitioning scheme to partition by both 'animal_id' and 'habitat'
spark.sql(""" ALTER TABLE default.zoo_animals_partition_evo ADD PARTITION FIELD habitat""")
```
New data inserted after the partitioning change will adhere to the new scheme.

## 6. Time Travel and Rollbacks

### Time Travel in Iceberg

Time travel allows you to query a table as it existed at a specific point in the past, leveraging Iceberg's snapshot-based architecture. You can specify a timestamp or snapshot ID when querying the table.

**Time Travel Benefits:**
*   Enables **historical queries** for auditing and investigating historical trends.
*   Allows **data recovery** from accidental corruption.
*   Simplifies rollbacks by querying an earlier snapshot.

**Example Time Travel (SPARK):**
After listing available snapshots (using `default.european_cars_time_travel.snapshots`):

```sql
# Fetch a specific snapshot ID, e.g., rollback_snapshot_id_1
# Travel back to when the USA Cars weren't present in the table
df_time_travel = spark.sql(f"""
SELECT * FROM default.european_cars_time_travel VERSION AS OF {rollback_snapshot_id_1}
""")
df_time_travel.show()
```

### Rollback Using Snapshots

Rollback reverts the table's current state to a specific snapshot, undoing subsequent changes. The rollback operation restores the table to the state of the specified snapshot.

**Example Rollback (SPARK):**

```sql
# Assume 'first_snapshot' is the ID of the desired state
# Call the Roll Back Command
spark.sql(f"CALL spark_catalog.system.rollback_to_snapshot('default.european_cars_rollback', {first_snapshot})").show()
```

## 7. Branching and Merging

### Branching in Iceberg

Branching lets you create isolated environments to work with data (inserting, updating, deleting) without affecting the main production dataset. This is useful for testing new features, running experiments, or isolating changes before they are stable.

**Example Branching (SPARK):**

```sql
# CREATE A BRANCH
spark.sql("ALTER TABLE default.healthcare_patient_data CREATE BRANCH testing_branch")

# Insert data into the new branch
spark.sql("""
INSERT INTO default.healthcare_patient_data.branch_testing_branch VALUES
('P999', 'Richard V', 99, 'Headache', 'Time', 'Dr. Jeff')
""")

# Verify the branch data
spark.sql("SELECT * FROM default.healthcare_patient_data.branch_testing_branch").show()

# Main table remains unaffected
spark.sql("SELECT * FROM default.healthcare_patient_data").show()
```

### Merging Branches in Iceberg

Merging consolidates the changes made in a branch back into the main dataset. Only new or modified records are merged.

**Example Merging (SPARK):**

```sql
# Merge the branch back into the base table
spark.sql("""
MERGE INTO default.healthcare_patient_data AS base
USING default.healthcare_patient_data.branch_testing_branch AS branch
ON base.patient_id = branch.patient_id
WHEN MATCHED THEN UPDATE SET base.patient_name = branch.patient_name,
base.age = branch.age,
...
WHEN NOT MATCHED THEN INSERT (patient_id, patient_name, age, diagnosis, treatment, doctor)
VALUES (branch.patient_id, branch.patient_name, branch.age, branch.diagnosis, branch.treatment, branch.doctor)
""")
```
After merging, the branch can be dropped if it is no longer needed.

## 8. Tagging (Versioning)

Tags label specific table versions (snapshots), making it easier to reference or roll back to that particular point in time. Tags simplify accessing a specific version of data, replacing the need to know the snapshot ID.

**How to Use Tags:**
*   **Versioning:** Mark versions with meaningful names (e.g., `v1.0` or `test_run`).
*   **Metadata Management:** Attach custom metadata to snapshots.
*   The `CREATE TAG` statement is used to create a tag for a snapshot and define the retention period.

**Example Tagging and Querying (SPARK):**

```sql
# CREATE TAG FOR THE LANDMARKS TABLE WITH RETENTION PERIOD
spark.sql("""
ALTER TABLE default.belfast_landmarks CREATE TAG TAG RETAIN 5 DAYS
""")

# Query the table using the created tag to see the snapshot at that specific point in time
spark.sql("SELECT * FROM default.belfast_landmarks VERSION AS OF 'TAG'").show(100, False)
```

## 9. Migration and Maintenance

### Iceberg Table Migration

Two primary methods exist for migrating existing tables (e.g., Parquet) to Iceberg:

1.  **In-Place Migration:** Converts data from Parquet to Iceberg format without moving or creating a new table. This method is faster and simpler for existing tables.
    *   *Spark Example:* `spark.sql("CALL system.migrate('default.cloudera_parquet')")`.
    *   *Impala Example:* `ALTER TABLE default.cloudera_parquet CONVERT TO ICEBERG;`.

2.  **CTAS Migration (CREATE TABLE AS SELECT):** Creates a **new** Iceberg table and inserts data from an existing Parquet/Hive table. This is ideal when a fresh Iceberg table is needed or more control over the migration process is desired.

### Iceberg Table Maintenance

#### Iceberg Compaction
Compaction merges small data files within an Iceberg table into larger files to improve query performance and reduce metadata overhead.

**Why Compaction is Important:**
*   Optimizes Read Performance by reducing the number of files scanned.
*   Reduces Metadata Overhead.
*   Enhances Storage Efficiency.

**Note:** Compaction rewrites data files, which may potentially limit time travel capabilities for older snapshots.

**Example Compaction (SPARK):**

```sql
# Rewrite data files to optimize file sizes (target 1GB per file)
spark.sql("""
CALL system.rewrite_data_files(table => 'default.machinery_compaction', options => map('target-file-size-bytes','1073741824'))
""").show()
```

#### Expiring Snapshots
Iceberg maintains a history of snapshots. Expiring snapshots removes older snapshots that are no longer needed, managing storage growth and improving metadata performance.

**Impact of Expiring Snapshots:**
*   Frees up storage space.
*   Improves query performance due to smaller metadata.
*   **Irreversible Data Loss:** Once expired, snapshots cannot be restored.

**Example Snapshot Expiration (SPARK):**

```sql
# Expire snapshots dynamically using collected snapshot IDs (e.g., rollback_snapshot_id_0, 1, 2)
spark.sql(f"""
CALL system.expire_snapshots(table => 'default.machinery_compaction', snapshot_ids => array({rollback_snapshot_id_0}, {rollback_snapshot_id_1}, {rollback_snapshot_id_2}))
""").show()
```

## 10. Useful Links

*   Apache Iceberg Opensource Documentation: `https://iceberg.apache.org/`
*   Cloudera Blog on Iceberg Rest Catalog & Data Sharing
*   Cloudera Blog Home Location
*   Contact: Joseph Turkington, Sales Engineer, `jturkington@cloudera.com`
