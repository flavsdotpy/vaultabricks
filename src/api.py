from fastapi import HTTPException, Query, APIRouter
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.workspace import AclPermission

from models import SecretCreate, SecretUpdate, AclCreate, AclUpdate


router = APIRouter(
    prefix="/api",
    tags=["secrets"],

)

@router.get("/scopes")
async def list_scopes(workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        scopes = client.secrets.list_scopes()
        return [scope.name for scope in scopes]
    except Exception as e:
        if "401" in str(e):
            raise HTTPException(status_code=401, detail="Invalid PAT or insufficient permissions")
        elif "404" in str(e):
            raise HTTPException(status_code=404, detail="Workspace not found")
        else:
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/scopes/{scope_name}/secrets")
async def list_secrets(scope_name: str, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        secrets = client.secrets.list_secrets(scope=scope_name)
        return [
            {
                "key": secret.key,
                "last_updated": secret.last_updated_timestamp if secret.last_updated_timestamp else None
            }
            for secret in secrets
        ]
    except Exception as e:
        if "401" in str(e):
            raise HTTPException(status_code=401, detail="Invalid PAT or insufficient permissions")
        elif "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope not found")
        else:
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/scopes/{scope_name}/secrets")
async def create_secret(scope_name: str, secret: SecretCreate, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        client.secrets.put_secret(scope=scope_name, key=secret.key, string_value=secret.value)
        return {"message": "Secret created successfully"}
    except Exception as e:
        if "401" in str(e):
            raise HTTPException(status_code=401, detail="Invalid PAT or insufficient permissions")
        elif "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope not found")
        else:
            raise HTTPException(status_code=500, detail=str(e))

@router.put("/scopes/{scope_name}/secrets/{key}")
async def update_secret(scope_name: str, key: str, secret: SecretUpdate, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        client.secrets.put_secret(scope=scope_name, key=key, string_value=secret.value)
        return {"message": "Secret updated successfully"}
    except Exception as e:
        if "401" in str(e):
            raise HTTPException(status_code=401, detail="Invalid PAT or insufficient permissions")
        elif "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope or secret not found")
        else:
            raise HTTPException(status_code=500, detail=str(e))

@router.delete("/scopes/{scope_name}/secrets/{key}")
async def delete_secret(scope_name: str, key: str, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        client.secrets.delete_secret(scope=scope_name, key=key)
        return {"message": "Secret deleted successfully"}
    except Exception as e:
        if "401" in str(e):
            raise HTTPException(status_code=401, detail="Invalid PAT or insufficient permissions")
        elif "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope or secret not found")
        else:
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/scopes/{scope_name}/acls")
async def list_acls(scope_name: str, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        acls = client.secrets.list_acls(scope=scope_name)
        return [
            {
                "principal": acl.principal,
                "permission": acl.permission
            }
            for acl in acls
        ]
    except Exception as e:
        if "401" in str(e):
            raise HTTPException(status_code=401, detail="Invalid PAT or insufficient permissions")
        elif "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope not found")
        else:
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/scopes/{scope_name}/acls")
async def create_acl(scope_name: str, acl: AclCreate, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        client.secrets.put_acl(scope=scope_name, principal=acl.principal, permission=AclPermission(acl.permission))
        return {"message": "ACL created successfully"}
    except Exception as e:
        if "401" in str(e):
            raise HTTPException(status_code=401, detail="Invalid PAT or insufficient permissions")
        elif "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope not found")
        else:
            raise HTTPException(status_code=500, detail=str(e))

@router.put("/scopes/{scope_name}/acls/{principal}")
async def update_acl(scope_name: str, principal: str, acl: AclUpdate, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        client.secrets.put_acl(scope=scope_name, principal=principal, permission=acl.permission)
        return {"message": "ACL updated successfully"}
    except Exception as e:
        if "401" in str(e):
            raise HTTPException(status_code=401, detail="Invalid PAT or insufficient permissions")
        elif "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope or ACL not found")
        else:
            raise HTTPException(status_code=500, detail=str(e))

@router.delete("/scopes/{scope_name}/acls/{principal}")
async def delete_acl(scope_name: str, principal: str, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        client.secrets.delete_acl(scope=scope_name, principal=principal)
        return {"message": "ACL deleted successfully"}
    except Exception as e:
        if "401" in str(e):
            raise HTTPException(status_code=401, detail="Invalid PAT or insufficient permissions")
        elif "404" in str(e):
            raise HTTPException(status_code=404, detail="Scope or ACL not found")
        else:
            raise HTTPException(status_code=500, detail=str(e)) 
