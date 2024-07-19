from azure.cosmos import CosmosClient
import os
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosHttpResponseError

_db_client = CosmosClient.from_connection_string(os.environ['AzureCosmosDBConnectionString']).get_database_client(os.environ['Database'])
_player_container_proxy = _db_client.get_container_client(os.environ['PlayerContainer'])
_prompt_container_proxy = _db_client.get_container_client(os.environ['PromptContainer'])

def query_player_items(query, parameters, enable_cross_partition_query=True):
    return list(_player_container_proxy.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=enable_cross_partition_query
    ))

def query_player_with_limit(query, parameters, max_item_count, enable_cross_partition_query=True):
    return list(_player_container_proxy.query_items(
        query=query,
        parameters=parameters,
        max_item_count=max_item_count,
        enable_cross_partition_query=enable_cross_partition_query
    ))

def query_prompt_items(query, parameters, enable_cross_partition_query=True):
    return list(_prompt_container_proxy.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=enable_cross_partition_query
    ))

def check_player_exists(username):
    query = 'SELECT * FROM c WHERE c.username = @username'
    parameters = [{"name": "@username", "value": username}]
    try:
        items = list(_player_container_proxy.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        return len(items) > 0
    except CosmosResourceNotFoundError:
        return False

def get_player_data(username):
    query = 'SELECT * FROM c WHERE c.username = @username'
    parameters = [{"name": "@username", "value": username}]
    try:
        items = list(_player_container_proxy.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        return items
    except CosmosResourceNotFoundError:
        return []

def create_player_item(item,enable_automatic_id_generation=True):
    try :
        return _player_container_proxy.create_item(body=item,enable_automatic_id_generation=enable_automatic_id_generation)
    except CosmosHttpResponseError as e:
        raise e

def replace_player_item(item, body):
    _player_container_proxy.replace_item(item=item, body=body)

def create_prompt_item(item,enable_automatic_id_generation):
    try:
        return _prompt_container_proxy.create_item(body=item,enable_automatic_id_generation=enable_automatic_id_generation)
    except CosmosHttpResponseError as e:
        raise e

def delete_prompt_item(item_id, username):
    try:
        _prompt_container_proxy.delete_item(item=item_id, partition_key=username)
        return True
    except CosmosResourceNotFoundError:
        return False
    except KeyError:
        return False
    except Exception as e:
        raise e

