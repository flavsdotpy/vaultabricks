from pydantic import BaseModel

class SecretCreate(BaseModel):
    key: str
    value: str

class SecretUpdate(BaseModel):
    value: str

class AclCreate(BaseModel):
    principal: str
    permission: str

class AclUpdate(BaseModel):
    permission: str
