from fastapi import HTTPException, Query, APIRouter, Request
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.workspace import AclPermission

from models import SecretCreate, SecretUpdate, AclCreate, AclUpdate, ScopeCreate
from utils import is_databricks_app, DATABRICKS_HOST

router = APIRouter(
    prefix="/api",
    tags=["secrets"],

)

def get_workspace_client(request: Request, workspace_host: str | None, pat: str | None) -> WorkspaceClient:
    if is_databricks_app():
        user_token = request.headers.get("x-forwarded-access-token")
        if not user_token:
            raise HTTPException(
                status_code=401,
                detail="No forwarded access token found. Ensure the app is accessed through the Databricks Apps proxy.",
            )
        return WorkspaceClient(host=DATABRICKS_HOST, token=user_token, auth_type="pat")

    if not workspace_host or not pat:
        raise HTTPException(
            status_code=400,
            detail="workspace_host and pat are required outside Databricks Apps",
        )

    return WorkspaceClient(host=workspace_host, token=pat, auth_type="pat")


def handle_api_error(error: Exception) -> None:
    if "401" in str(error):
        detail = (
            "Databricks app authentication failed or insufficient permissions"
            if is_databricks_app()
            else "Invalid PAT or insufficient permissions"
        )
        raise HTTPException(status_code=401, detail=detail)

    if "404" in str(error):
        raise HTTPException(status_code=404, detail="Resource not found")

    if isinstance(error, HTTPException):
        raise error

    raise HTTPException(status_code=500, detail=str(error))

@router.get("/scopes")
async def list_scopes(request: Request, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        scopes = client.secrets.list_scopes()
        return [scope.name for scope in scopes]
    except Exception as e:
        handle_api_error(e)


@router.post("/scopes")
async def create_scope(request: Request, scope: ScopeCreate, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        client.secrets.create_scope(scope=scope.name)
        return {"message": "Scope created successfully"}
    except Exception as e:
        if "409" in str(e):
            raise HTTPException(status_code=409, detail="Scope already exists")
        handle_api_error(e)


@router.get("/scopes/{scope_name}/secrets")
async def list_secrets(request: Request, scope_name: str, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        secrets = client.secrets.list_secrets(scope=scope_name)
        return [
            {
                "key": secret.key,
                "last_updated": secret.last_updated_timestamp if secret.last_updated_timestamp else None
            }
            for secret in secrets
        ]
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope not found")
        handle_api_error(e)


@router.post("/scopes/{scope_name}/secrets")
async def create_secret(request: Request, scope_name: str, secret: SecretCreate, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        client.secrets.put_secret(scope=scope_name, key=secret.key, string_value=secret.value)
        return {"message": "Secret created successfully"}
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope not found")
        handle_api_error(e)


@router.put("/scopes/{scope_name}/secrets/{key}")
async def update_secret(request: Request, scope_name: str, key: str, secret: SecretUpdate, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        client.secrets.put_secret(scope=scope_name, key=key, string_value=secret.value)
        return {"message": "Secret updated successfully"}
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope or secret not found")
        handle_api_error(e)


@router.delete("/scopes/{scope_name}/secrets/{key}")
async def delete_secret(request: Request, scope_name: str, key: str, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        client.secrets.delete_secret(scope=scope_name, key=key)
        return {"message": "Secret deleted successfully"}
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope or secret not found")
        handle_api_error(e)


@router.get("/scopes/{scope_name}/acls")
async def list_acls(request: Request, scope_name: str, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        acls = client.secrets.list_acls(scope=scope_name)
        return [
            {
                "principal": acl.principal,
                "permission": acl.permission
            }
            for acl in acls
        ]
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope not found")
        handle_api_error(e)


@router.post("/scopes/{scope_name}/acls")
async def create_acl(request: Request, scope_name: str, acl: AclCreate, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        client.secrets.put_acl(scope=scope_name, principal=acl.principal, permission=AclPermission(acl.permission))
        return {"message": "ACL created successfully"}
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope not found")
        handle_api_error(e)


@router.put("/scopes/{scope_name}/acls/{principal}")
async def update_acl(request: Request, scope_name: str, principal: str, acl: AclUpdate, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        client.secrets.put_acl(scope=scope_name, principal=principal, permission=AclPermission(acl.permission))
        return {"message": "ACL updated successfully"}
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope or ACL not found")
        handle_api_error(e)


@router.delete("/scopes/{scope_name}/acls/{principal}")
async def delete_acl(request: Request, scope_name: str, principal: str, workspace_host: str | None = Query(None), pat: str | None = Query(None)):
    try:
        client = get_workspace_client(request, workspace_host, pat)
        client.secrets.delete_acl(scope=scope_name, principal=principal)
        return {"message": "ACL deleted successfully"}
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope or ACL not found")
        handle_api_error(e)
