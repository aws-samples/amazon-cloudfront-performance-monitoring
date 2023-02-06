CREATE EXTERNAL TABLE IF NOT EXISTS rtlogs (
timestamp1 TIMESTAMP,
c_ip STRING,
time_to_first_byte FLOAT,
sc_status STRING,
sc_bytes FLOAT,
cs_method STRING,
cs_protocol STRING,
cs_host STRING,
cs_uri_stem STRING,
cs_bytes FLOAT,
x_edge_location STRING,
x_edge_request_id STRING,
x_host_header STRING,
time_taken FLOAT,
cs_protocol_version STRING,
c_ip_version STRING,
cs_user_agent STRING,
cs_referer STRING,
cs_cookie STRING,
cs_uri_query STRING,
x_edge_response_result_type STRING,
x_forwarded_for STRING,
ssl_protocol STRING,
ssl_cipher STRING,
x_edge_result_type STRING,
fle_encrypted_fields STRING,
fle_status STRING,
sc_content_type STRING,
sc_content_len BIGINT,
sc_range_start BIGINT,
sc_range_end BIGINT,
c_port INT,
x_edge_detailed_result_type STRING,
c_country STRING,
cs_accept_encoding STRING,
cs_accept STRING,
cache_behavior_path_pattern STRING,
cs_headers STRING,
cs_header_names STRING,
cs_headers_count STRING,
primary_distribution_id STRING,
primary_distribution_dns_name STRING,
origin_fbl FLOAT,
origin_lbl FLOAT,
asn STRING
)
PARTITIONED BY (dt string)
ROW FORMAT DELIMITED 
FIELDS TERMINATED BY '\t'
LOCATION 's3://BUCKET_NAME'
TBLPROPERTIES ('skip.header.line.count'='0')