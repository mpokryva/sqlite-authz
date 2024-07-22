#!/bin/bash

divider="----------------------------------------"

# 1. Create an API Key
echo -e "$divider\n"
echo "Step 1: Creating an API Key"
api_key_response=$(curl -s -X POST http://localhost:3000/api_keys)
api_key=$(echo $api_key_response | jq -r '.api_key')
echo "Created API Key: $api_key"

# 2. Create a Table
echo -e "$divider\n"
echo "Step 2: Creating Table my_table"
create_table_response=$(curl -s -X POST http://localhost:3000/query \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE TABLE my_table (col1 INT)"
  }')
echo $create_table_response

# 3. Create a Select Policy
echo -e "$divider\n"
echo "Step 3: Creating allow select policy on my_table"
create_policy_response=$(curl -s -X POST http://localhost:3000/policies \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "actions": ["select"],
    "resource": "my_table",
    "effect": "allow"
  }')
policy_id=$(echo $create_policy_response | jq -r '.id')
echo "Created Select Policy ID: $policy_id"

# 4. List Policies
echo -e "$divider\n"
echo "Step 4: Listing Policies"
curl -s -X GET http://localhost:3000/policies \
  -u $api_key:

# 5. Execute an Authorized Select Query
echo -e "$divider\n"
echo "Step 5: Executing authorized SELECT query on my_table"
authorized_query_response=$(curl -s -X POST http://localhost:3000/query \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM my_table"
  }')
echo $authorized_query_response

# 6. Delete the Select Policy
echo -e "$divider\n"
echo "Step 6: Deleting the allow select policy on my_table"
delete_policy_response=$(curl -s -X DELETE http://localhost:3000/policies/$policy_id \
  -u $api_key:)
echo "Deleted Select Policy ID: $policy_id"

# 7. Execute an Unauthorized Select Query
echo -e "$divider\n"
echo "Step 7: Executing unauthorized SELECT query on my_table"
unauthorized_query_response=$(curl -s -X POST http://localhost:3000/query \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM my_table"
  }')
echo $unauthorized_query_response

# 8. Attempt to Insert Without Policy
echo -e "$divider\n"
echo "Step 8: Attempting to INSERT into my_table without policy"
unauthorized_insert_response=$(curl -s -X POST http://localhost:3000/query \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "query": "INSERT INTO my_table (col1) VALUES (1)"
  }')
echo $unauthorized_insert_response

# 9. Create an Insert Policy
echo -e "$divider\n"
echo "Step 9: Creating allow insert policy on my_table"
create_insert_policy_response=$(curl -s -X POST http://localhost:3000/policies \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "actions": ["insert"],
    "resource": "my_table",
    "effect": "allow"
  }')
insert_policy_id=$(echo $create_insert_policy_response | jq -r '.id')
echo "Created Insert Policy ID: $insert_policy_id"

# 10. Attempt to Insert With Policy
echo -e "$divider\n"
echo "Step 10: Attempting to INSERT into my_table with policy"
authorized_insert_response=$(curl -s -X POST http://localhost:3000/query \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "query": "INSERT INTO my_table (col1) VALUES (1)"
  }')
echo $authorized_insert_response

# 11. Clean Up Insert Policy
echo -e "$divider\n"
echo "Step 11: Deleting the allow insert policy on my_table"
delete_insert_policy_response=$(curl -s -X DELETE http://localhost:3000/policies/$insert_policy_id \
  -u $api_key:)
echo "Deleted Insert Policy ID: $insert_policy_id"

# 12. Attempt to Insert After Removing the Insert Policy
echo -e "$divider\n"
echo "Step 12: Attempting to INSERT into my_table after removing insert policy"
unauthorized_insert_response_after_removal=$(curl -s -X POST http://localhost:3000/query \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "query": "INSERT INTO my_table (col1) VALUES (1)"
  }')
echo $unauthorized_insert_response_after_removal

# 13. Create an Allow Everything Policy
echo -e "$divider\n"
echo "Step 13: Creating allow everything policy"
create_allow_everything_policy_response=$(curl -s -X POST http://localhost:3000/policies \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "effect": "allow"
  }')
allow_everything_policy_id=$(echo $create_allow_everything_policy_response | jq -r '.id')
echo "Created Allow Everything Policy ID: $allow_everything_policy_id"

# 14. Execute an Authorized Select Query with Allow Everything Policy
echo -e "$divider\n"
echo "Step 14: Executing authorized SELECT query with allow everything policy"
authorized_query_response=$(curl -s -X POST http://localhost:3000/query \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM my_table"
  }')
echo $authorized_query_response

# 15. Create a Deny Select Policy
echo -e "$divider\n"
echo "Step 15: Creating deny select policy on my_table"
create_deny_select_policy_response=$(curl -s -X POST http://localhost:3000/policies \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "actions": ["select"],
    "resource": "my_table",
    "effect": "deny"
  }')
deny_select_policy_id=$(echo $create_deny_select_policy_response | jq -r '.id')
echo "Created Deny Select Policy ID: $deny_select_policy_id"

# 16. Execute an Unauthorized Select Query with Deny Select Policy
echo -e "$divider\n"
echo "Step 16: Executing unauthorized SELECT query with deny select policy"
unauthorized_query_response=$(curl -s -X POST http://localhost:3000/query \
  -u $api_key: \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM my_table"
  }')
echo $unauthorized_query_response

echo -e "$divider\n"
echo "All steps completed."
