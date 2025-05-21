from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from databricks.sdk import WorkspaceClient
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
import os

app = FastAPI(title="Vaultabricks")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SecretCreate(BaseModel):
    key: str
    value: str

class SecretUpdate(BaseModel):
    value: str

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/scopes")
async def list_scopes(workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        # Validate workspace host
        if not workspace_host.startswith("https://") or not workspace_host.endswith(".databricks.com"):
            raise HTTPException(status_code=400, detail="Invalid workspace host URL")

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

@app.get("/api/scopes/{scope_name}/secrets")
async def list_secrets(scope_name: str, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        # Validate workspace host
        if not workspace_host.startswith("https://") or not workspace_host.endswith(".databricks.com"):
            raise HTTPException(status_code=400, detail="Invalid workspace host URL")

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

@app.post("/api/scopes/{scope_name}/secrets")
async def create_secret(scope_name: str, secret: SecretCreate, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        # Validate workspace host
        if not workspace_host.startswith("https://") or not workspace_host.endswith(".databricks.com"):
            raise HTTPException(status_code=400, detail="Invalid workspace host URL")

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

@app.put("/api/scopes/{scope_name}/secrets/{key}")
async def update_secret(scope_name: str, key: str, secret: SecretUpdate, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        # Validate workspace host
        if not workspace_host.startswith("https://") or not workspace_host.endswith(".databricks.com"):
            raise HTTPException(status_code=400, detail="Invalid workspace host URL")

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

@app.delete("/api/scopes/{scope_name}/secrets/{key}")
async def delete_secret(scope_name: str, key: str, workspace_host: str = Query(...), pat: str = Query(...)):
    try:
        # Validate workspace host
        if not workspace_host.startswith("https://") or not workspace_host.endswith(".databricks.com"):
            raise HTTPException(status_code=400, detail="Invalid workspace host URL")

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

@app.get("/api/scopes/{scope_name}/secrets/{key}")
async def get_secret(scope_name: str, key: str, workspace_host: str, pat: str):
    try:
        client = WorkspaceClient(host=workspace_host, token=pat)
        secret = client.secrets.get_secret(scope=scope_name, key=key)
        return {"value": secret.value}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) 
