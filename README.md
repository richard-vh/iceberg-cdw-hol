# Open Data Lakehouse - Apache Iceberg on Cloudera DataWarehouse HOL

This document explores some of the core features of Apache Iceberg, including table creation, data insertion, schema evolution, and time travel.

### Steps to manually publish the guide

* Create a Python Virtual Environment

   ```bash
   python3 -m venv ~/mkdocs_venv
   source ~/mkdocs_venv/bin/activate
   ```

* Clone the <REPOSITORY_NAME> GitHub repository

  ```bash
  git clone https://github.com/richard-vh/iceberg-cdw-hol.git
  ```

* Install Required Dependencies for MkDocs

   ```bash
   cd iceberg-cdw-hol/mkdocs
   pip install -r requirements.txt
   ```

* Run the following command to test your guide locally:

   ```bash
   mkdocs serve
   ```

   Open `http://127.0.0.1:8000` in your browser to view the guide.


   ```bash
   mkdocs gh-deploy -r origin --no-history
   ```
