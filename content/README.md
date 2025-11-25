# Open Data Lakehouse - Apache Iceberg Features and Management

This document explores some of the core features of Apache Iceberg, including table creation, data insertion, schema evolution, and time travel.

<div class="username-input-container">
    <input type="text" id="user-username-input" placeholder="e.g., john.doe">
    <button id="user-username-save">Update Examples</button>
    <button id="user-username-clear">Reset</button>
</div>

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
* You need Iceberg to fully handle both the data and metadata.
* You want to manage the entire lifecycle of the table automatically.
* You require atomic operations, such as partition evolution, schema evolution, and time travel.

### Key Benefits and Limitations

**Benefits:** 

* Simplified data management.
* Automatic metadata handling.
* Built-in features like time travel and schema evolution.

**Limitations:** 

* Dropping the table automatically deletes all data.


!!! note
    By default, when creating an Iceberg table, it will be a **Copy-on-Write (COW)** table. You can explicitly specify the table type as Copy-on-Write (COW) or Merge-on-Write (MOR) using table properties.

### Table Creation Example

!!! tip "IMPALA"
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
The **`SHOW CREATE TABLE`** command confirms the Iceberg table's definition. Checking the HDFS location reveals that Iceberg manages both data (**`data/`**) and metadata (**`metadata/`**) directories within the table's storage path.

- **`metadata/`** contains snapshots, schema history, and manifest files.
- **`data/`** contains the actual table data files.

Iceberg uses the **`metadata/`** directory to manage partitioning and versioning, without relying on Hive Metastore. The **`data/`    ** directory contains the actual table data files.

### Code Example

!!! tip "IMPALA"
    ```
    -- Get the Iceberg table definition
    SHOW CREATE TABLE default.managed_countries;
    ```

!!! tip "BASH"
    ```
    # Check the Object Store directory for Iceberg metadata and data
    [jturkington@XYZ-es01 ~]$ hdfs dfs -ls s3a://.../external/hive/default.db/managed_countries/metadata
    -rw-r--r--   3 jturkington hive       1710 2025-02-05 12:55 hdfs://.../external/hive/default.db/managed_countries/metadata/00000-bc161db1-05f2-4d64-baab-69ca2070db33.metadata.json
    -rw-r--r--   3 jturkington hive       6072 2025-02-05 04:05 hdfs://.../external/hive/default.db/managed_countries/metadata/3ecfea4f-9e06-45a9-bd7c-430fe4758283-m0.avro
    -rw-r--r--   3 jturkington hive       3800 2025-02-05 12:55 hdfs://.../external/hive/default.db/managed_countries/metadata/snap-1185275548636187694-1-f7f549e1-bd07-44da-b170-8973c2e6e3d6.avro
    ```


### Understanding the Metadata Files
Iceberg uses several types of metadata files to track table state and manage its partitions. Below are the types of metadata files found in the **`metadata/`** directory.

![](https://raw.githubusercontent.com/richard-vh/iceberg-cdw-hol/refs/heads/main/content/assets/images/iceberg_file_structure.png)

#### <ins>Metadata JSON Files (*.metadata.json)</ins>
**Example Files:**
00000-bc161db1-05f2-4d64-baab-69ca2070db33.metadata.json

**Purpose:** Stores table-level metadata such as schema, partitioning, snapshots, and file references. Each time the table structure changes (e.g., schema evolution, snapshot creation), a new metadata JSON file is generated. Older metadata files are retained to support time travel and rollback.<br/>
**Data Type:** JSON format (human-readable, structured key-value pairs).<br/>
**Why?** JSON allows Iceberg to store metadata in a flexible, easily accessible format. New versions can be created without modifying existing files, enabling schema evolution.

#### <ins>Snapshot Files (snap-*.avro)</ins>
**Example Files:**
snap-1185275548636187694-1-f7f549e1-bd07-44da-b170-8973c2e6e3d6.avro

**Purpose:** Tracks table state at a specific point in time (snapshot ID, timestamp, manifest list, etc.). Allows for time travel and rollbacks to previous versions of the table.<br/>
**Data Type:** Apache Avro format (binary, optimized for structured data storage).<br/>
**Why?** Storing snapshots in Avro provides efficient serialization while keeping metadata compact and performant. Enables fast lookup of previous states for Iceberg’s time travel feature.

#### <ins>Manifest List Files (*-m0.avro)</ins>
**Example Files:**
3ecfea4f-9e06-45a9-bd7c-430fe4758283-m0.avro

**Purpose:** Stores a list of manifest files associated with a snapshot. Helps Iceberg quickly determine which data files belong to which snapshot without scanning the entire table.<br/>
**Data Type:** Apache Avro format (binary, optimized for fast read/write).<br/>
**Why?** Avro is compact and supports schema evolution, making it ideal for metadata storage. Using Avro instead of JSON for large metadata speeds up querying and file tracking.

### How These Files Work Together in Iceberg

**Metadata JSON file** (*.metadata.json) defines the table schema and references snapshots.

**Snapshot file** (snap-*.avro) records changes and links to manifest lists.

**Manifest list file** (*-m0.avro) references manifest files that contain details of individual data files.

These components work together to support partitioning, versioning, and time travel, allowing Iceberg to provide robust table management with features like schema evolution and data consistency.

## 3. Inserts, Updates, and Deletes

In Iceberg, data manipulation (inserts, updates, deletes) is performed using standard SQL commands.

### Inserting & Updating Data

Updates modify existing records based on a condition.

**Best Practices:**

* Ensure the schema is well-defined.
* Perform updates only when necessary to avoid frequent schema changes.
* Monitor table performance as data grows, especially with large updates.

**Code Example**

!!! tip "IMPALA"
    ```sql
    -- Drop the table if it exists
    DROP TABLE IF EXISTS default.english_football_teams;
    
    -- Create the table for football teams in England
    CREATE TABLE default.english_football_teams (
        team_id STRING,
        team_name STRING,
        team_city STRING,
        team_stadium STRING
    ) STORED AS ICEBERG;
    
    -- Inserting data into the table
    INSERT INTO default.english_football_teams 
    VALUES 
    ('T001', 'Manchester United', 'Manchester', 'Old Trafford'),
    ('T002', 'Liverpool', 'Liverpool', 'Anfield'),
    ('T003', 'Chelsea', 'London', 'Stamford Bridge');
    
    -- Select all data from the table
    SELECT * FROM default.english_football_teams;
    
    -- Update Stadium Name
    UPDATE default.english_football_teams 
    SET team_stadium = 'New Stamford Bridge' 
    WHERE team_id = 'T003';
    
    -- Select the updated data
    SELECT * FROM default.english_football_teams;
    ```

### Handling Data Deletions

Iceberg uses a **snapshot mechanism**, so deletions add a new snapshot but do not immediately remove the physical data. This ensures that deleted data can still be recovered.

**Considerations:**

* Deletions are versioned and can be reverted through time travel.
* You can configure Iceberg to perform data compaction after deletion for performance optimization.

**Code Example**

!!! tip "IMPALA"
    ```sql
    -- Drop the table if it exists
    DROP TABLE IF EXISTS default.english_football_teams;
    
    -- Create the table for football teams in England with ICEBERG storage
    CREATE TABLE default.english_football_teams (
        team_id STRING,
        team_name STRING,
        team_city STRING,
        team_stadium STRING
    ) STORED AS ICEBERG;
    
    -- Inserting data into the table
    INSERT INTO default.english_football_teams 
    VALUES 
    ('T001', 'Manchester United', 'Manchester', 'Old Trafford'),
    ('T002', 'Liverpool', 'Liverpool', 'Anfield'),
    ('T003', 'Chelsea', 'London', 'Stamford Bridge');
    
    -- Select all data from the table
    SELECT * FROM default.english_football_teams;
    
    -- Delete using Team ID 
    DELETE FROM default.english_football_teams WHERE team_id = 'T003';
    
    -- Select the updated data
    SELECT * FROM default.english_football_teams;
    ```

## 4. Iceberg Table Types (COW and MOR)

Iceberg tables support different storage strategies to balance performance, storage efficiency, and query speed. This section introduces the two primary approaches.

* **Copy-on-Write (COW)**: Ensures immutability by writing new files on every update, making it ideal for ACID transactions and historical auditing.
* **Merge-on-Read (MOR)**: Optimizes write performance by storing changes as delta files, merging them at query time—useful for real-time ingestion.

Each strategy has trade-offs, making them suitable for different workloads.

**Merge-On-Read (MOR)**

* Writes are efficient.
* Reads are less efficient due to read amplification, but regularly scheduled compaction can reduce inefficiency.
* A good choice when streaming.
* A good choice when frequently writing or updating, such as running hourly batch jobs.
* A good choice when the percentage of data change is low.

**Copy-On-Write (COW)**

* Reads are efficient.
* A good choice for bulk updates and deletes, such as running a daily batch job.
* Writes less efficient due to write amplification, but the need for compaction is reduced.
* A good choice when the percentage of data change is high.

### Iceberg Copy-on-Write (COW) Table

**What is it?**

Copy-on-Write (COW) is where instead of modifying data directly, the system creates a complete copy of the data file with the changes applied. This method makes reading data incredibly fast and efficient, as queries can simply access a clean, final version of a file without any extra processing. The downside, however, is that writing data can be slow and expensive. Even a tiny update to a single row forces the entire file to be duplicated and rewritten. This makes frequent, small changes inefficient and can lead to conflicts if multiple writes occur at the same time. While this approach is poorly suited for minor edits, it becomes ideal for large, bulk updates where changing a significant portion of the file is necessary anyway.

**How to create an COW Table:**

!!! tip "IMPALA"
    ```sql
    DROP TABLE IF EXISTS default.cow_european_countries;
    
    CREATE TABLE default.cow_european_countries (
        country_code STRING,
        country_name STRING,
        population BIGINT,
        area_km2 DOUBLE,
        last_updated TIMESTAMP
        )
    USING iceberg
    TBLPROPERTIES (
        'write.format.default'='orc', 
        'write.delete.mode'='copy-on-write',  -- Enable COW for delete operations
        'write.update.mode'='copy-on-write',  -- Enable COW for update operations
        'write.merge.mode'='copy-on-write'    -- Enable COW for compaction
    );

    SHOW TBLPROPERTIES default.cow_european_countries;
    ```
    
### Iceberg Merge-on-Read (MOR) Table

**What is it?**

Merge-on-Read (MOR) is where, instead of rewriting large files for every modification, changes are simply recorded in separate, smaller files. This approach makes writing new data, like updates or deletions, significantly faster. The trade-off is that more work is required during a read operation; the system must combine the original data with the separate change files on the fly to present the most current version. In Apache Iceberg, this is handled using delete files. When you update or delete a row, the change is logged in a delete file. During a query, Iceberg uses these delete files to know which rows to ignore from the old data files and which new rows to include. Eventually, compaction merges the original data and all the changes into new, clean files, which speeds up future reads.


**How to create an MOR Table:**

!!! tip "IMPALA"
    ```sql
    DROP TABLE IF EXISTS default.mor_european_countries;
    
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
    );

    SHOW TBLPROPERTIES default.mor_european_countries;
    ```
