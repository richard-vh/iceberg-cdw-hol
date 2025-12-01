# Hands On Lab - Introduction to Apache Iceberg on Cloudera Data Warehouse

This Hands On Lab explores some of the core features of Apache Iceberg using Cloudera Data Warehouse, including table creation, data insertion, schema evolution, and time travel.

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
   mkdocs serve -a 0.0.0.0:8000
   ```

* Open `http://<hostname>:8000` in your browser to view the guide.

![](https://raw.githubusercontent.com/richard-vh/iceberg-cdw-hol/refs/heads/main/content/assets/images/hol_docs.png)
