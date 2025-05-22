document.addEventListener('DOMContentLoaded', () => {
    let isLocked = false;
    let currentScope = '';
    let currentSecret = null;
    let currentAclPrincipal = null;

    const $ = (id) => document.getElementById(id);

    $('toggleLock').addEventListener('click', () => {
        isLocked = !isLocked;
        $('pat').disabled = isLocked;
        $('workspaceHost').disabled = isLocked;
        $('toggleLock').innerHTML = isLocked 
            ? '<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>'
            : '<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>';
    });

    const validateWorkspaceHost = (host) => {
        try {
            const url = new URL(host);
            return url.protocol === 'https:' && url.hostname.endsWith('.databricks.com');
        } catch {
            return false;
        }
    };

    const validatePAT = (pat) => {
        return /^dapi[a-fA-F0-9]{32}$/.test(pat);
    };

    const showScopeDetails = async (scopeName) => {
        currentScope = scopeName;

        $('scopeName').textContent = scopeName;
        showState($('scopeDetails'));

        try {
            await Promise.all([
                fetchSecrets(scopeName),
                fetchAcls(scopeName)
            ]);
        } catch (error) {
            console.error('Error loading scope details:', error);
        } finally {
            $('secretsLoadingState').classList.add('hidden');
            $('aclsLoadingState').classList.add('hidden');
        }
    };

    const showState = (state) => {
        [$('initialState'), $('loadingState'), $('errorState'), $('emptyState'), $('scopesList'), $('scopeDetails')].forEach(el => {
            el.classList.add('hidden');
        });
        state.classList.remove('hidden');
    };

    const showSecretsState = (state) => {
        [$('secretsList'), $('emptySecretsState'), $('secretsErrorState'), $('secretsLoadingState')].forEach(el => {
            el.classList.add('hidden');
        });
        state.classList.remove('hidden');
    };

    const showAclsState = (state) => {
        [$('aclsList'), $('emptyAclsState'), $('aclsErrorState'), $('aclsLoadingState')].forEach(el => {
            el.classList.add('hidden');
        });
        state.classList.remove('hidden');
    };

    const showConfirmation = (title, message, onConfirm) => {
        $('confirmationTitle'	).textContent = title;
        $('confirmationMessage').textContent = message;
        $('confirmationModal').classList.remove('hidden');
        
        const handleConfirm = () => {
            $('confirmationModal').classList.add('hidden');
            onConfirm();
            $('confirmationConfirm').removeEventListener('click', handleConfirm);
            $('confirmationCancel').removeEventListener('click', handleCancel);
        };

        const handleCancel = () => {
            $('confirmationModal').classList.add('hidden');
            $('confirmationConfirm').removeEventListener('click', handleConfirm);
            $('confirmationCancel').removeEventListener('click', handleCancel);
        };

        $('confirmationConfirm').addEventListener('click', handleConfirm);
        $('confirmationCancel').addEventListener('click', handleCancel);
    };

    const showSecretForm = (title, secret = null) => {
        currentSecret = secret;
        $('secretFormTitle').textContent = title;
        $('secretKey').value = secret ? secret.key : '';
        $('secretValue').value = '';
        $('secretValue').placeholder = secret ? '****redacted****' : '';
        $('secretKey').disabled = !!secret;
        
        $('keyError').classList.add('hidden');
        $('valueError').classList.add('hidden');
        $('secretFormModal').classList.remove('hidden');
    };

    const hideSecretForm = () => {
        $('secretFormModal').classList.add('hidden');
        $('secretForm').reset();
        currentSecret = null;
    };

    const fetchScopes = async () => {
        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        if (!workspaceHost || !pat) {
            showState($('initialState'));
            return;
        }

        if (!validateWorkspaceHost(workspaceHost)) {
            $('errorMessage').textContent = 'Invalid workspace host URL. Must be a valid Databricks workspace URL (e.g., https://your-workspace.cloud.databricks.com)';
            showState($('errorState'));
            return;
        }

        if (!validatePAT(pat)) {
            $('errorMessage').textContent = 'Invalid PAT format. Must be a 32 character hex string.';
            showState($('errorState'));
            return;
        }

        try {
            showState($('loadingState'));
            
            const response = await fetch(`/api/scopes?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`);
            if (!response.ok) {
                const error = await response.json();
                if (response.status === 401) {
                    throw new Error('Invalid PAT or insufficient permissions');
                } else if (response.status === 404) {
                    throw new Error('Workspace not found');
                } else {
                    throw new Error(error.detail || 'Failed to fetch scopes');
                }
            }
            
            const scopes = await response.json();
            
            if (scopes.length === 0) {
                showState($('emptyState'));
                return;
            }

            $('scopesGrid').innerHTML = '';
            
            scopes.forEach(scope => {
                const scopeItem = $('scopeItemTemplate').content.cloneNode(true);
                const scopeDiv = scopeItem.querySelector('div');
                scopeDiv.dataset.scopeName = scope;
                scopeDiv.querySelector('h3').textContent = scope;
                scopeDiv.addEventListener('click', () => showScopeDetails(scope));
                $('scopesGrid').appendChild(scopeItem);
            });

            showState($('scopesList'));
        } catch (error) {
            $('errorMessage').textContent = error.message;
            showState($('errorState'));
        }
    };

    const showCreateScopeForm = () => {
        $('createScopeModal').classList.remove('hidden');
        $('scopeForm').reset();
        $('scopeNameError').classList.add('hidden');
    }

    const hideCreateScopeForm = () => {
        $('createScopeModal').classList.add('hidden');
    }    

    const createScope = async (scopeName) => {
        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        const response = await fetch(`/api/scopes?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: scopeName
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create secret');
        }
    };

    $('createScope').addEventListener('click', showCreateScopeForm);
    $('cancelCreateScope').addEventListener('click', hideCreateScopeForm);
    $('scopeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const scopeName = $('scopeNameInput').value.trim();
        let hasError = false;

        $('scopeNameError').classList.add('hidden');

        if (!scopeName) {
            $('scopeNameError').classList.remove('hidden');
            hasError = true;
        }

        if (hasError) {
            return;
        }

        try {
            await createScope(scopeName);
            hideCreateScopeForm();
            fetchScopes();
        } catch (error) {
            $('errorMessage').textContent = error.message;
            showState($('errorState'));
            hideCreateScopeForm();
        }
    });

    const fetchSecrets = async (scopeName) => {
        $('secretsList').innerHTML = '';
        showSecretsState($('secretsLoadingState'));

        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        try {
            const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/secrets?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`);
            if (!response.ok) {
                const error = await response.json();
                if (response.status === 401) {
                    throw new Error('Invalid PAT or insufficient permissions');
                } else if (response.status === 404) {
                    throw new Error('Scope not found');
                } else {
                    throw new Error(error.detail || 'Failed to fetch secrets');
                }
            }
            
            const secrets = await response.json();

            if (secrets.length === 0) {
                showSecretsState($('emptySecretsState'));
            } else {
                secrets.forEach(secret => {
                    const secretItem = $('secretItemTemplate').content.cloneNode(true);
                    secretItem.querySelector('h3').textContent = secret.key;
                    secretItem.querySelector('.lastUpdated').textContent = secret.last_updated 
                        ? new Date(parseInt(secret.last_updated)).toLocaleString() 
                        : 'Never';
                    
                    const editButton = secretItem.querySelector('.editSecret');
                    const deleteButton = secretItem.querySelector('.deleteSecret');
                    
                    editButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showSecretForm('Edit Secret', secret);
                    });
                    
                    deleteButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showConfirmation(
                            'Delete Secret',
                            `Are you sure you want to delete the secret "${secret.key}"? This action cannot be undone.`,
                            () => deleteSecret(scopeName, secret.key)
                        );
                    });
                    
                    $('secretsList').appendChild(secretItem);
                });
                showSecretsState($('secretsList'));
            }
        } catch (error) {
            $('secretsErrorMessage').textContent = error.message;
            showSecretsState($('secretsErrorState'));
        }
    };

    const createSecret = async (scopeName, key, value) => {
        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/secrets?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ key, value }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create secret');
        }

    };

    const updateSecret = async (scopeName, key, value) => {
        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/secrets/${encodeURIComponent(key)}?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ value }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update secret');
        }
    };

    const deleteSecret = async (scopeName, key) => {
        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/secrets/${encodeURIComponent(key)}?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete secret');
        }

        fetchSecrets(scopeName);
    };

    $('workspaceHost').addEventListener('change', fetchScopes);
    $('pat').addEventListener('change', fetchScopes);
    $('refreshScopes').addEventListener('click', fetchScopes);
    $('refreshScopesError').addEventListener('click', fetchScopes);
    $('refreshScopesEmpty').addEventListener('click', fetchScopes);
    $('backToScopes').addEventListener('click', () => {
        showState($('scopesList'));
    });
    
    $('refreshDetails').addEventListener('click', async () => {
        showScopeDetails(currentScope)
    });

    $('addSecret').addEventListener('click', () => {
        showSecretForm('Add Secret');
    });

    $('secretFormCancel').addEventListener('click', hideSecretForm);

    $('secretForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = $('secretKey').value.trim();
        const value = $('secretValue').value.trim();
        let hasError = false;

        $('keyError').classList.add('hidden');
        $('valueError').classList.add('hidden');

        if (!key) {
            $('keyError').classList.remove('hidden');
            hasError = true;
        }

        if (!value || value === '****redacted****') {
            $('valueError').classList.remove('hidden');
            hasError = true;
        }

        if (hasError) {
            return;
        }

        try {
            if (currentSecret) {
                await updateSecret(currentScope, key, value);
            } else {
                await createSecret(currentScope, key, value);
            }
            hideSecretForm();
            fetchSecrets(currentScope);
        } catch (error) {
            $('secretsErrorMessage').textContent = error.message;
            showSecretsState($('secretsErrorState'));
            hideSecretForm();
        }
    });

    const showAclForm = (title, acl = null) => {
        currentAclPrincipal = acl ? acl.principal : null;
        $('aclFormTitle').textContent = title;
        $('aclPrincipal').value = acl ? acl.principal : '';
        $('aclPrincipal').disabled = !!acl;
        $('aclPermission').value = acl ? acl.permission : '';
        $('aclFormSubmit').textContent = acl ? 'Update' : 'Create';
        
        $('principalError').classList.add('hidden');
        $('permissionError').classList.add('hidden');
        $('aclFormModal').classList.remove('hidden');
    };

    const hideAclForm = () => {
        $('aclFormModal').classList.add('hidden');
        $('aclForm').reset();
        currentAclPrincipal = null;
    };

    const fetchAcls = async (scopeName) => {
        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        $('aclsList').innerHTML = '';
        showAclsState($('aclsLoadingState'));

        try {
            const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/acls?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`);
            if (!response.ok) {
                const error = await response.json();
                if (response.status === 401) {
                    throw new Error('Invalid PAT or insufficient permissions');
                } else if (response.status === 404) {
                    throw new Error('Scope not found');
                } else {
                    throw new Error(error.detail || 'Failed to fetch ACLs');
                }
            }
            
            const acls = await response.json();
            
            if (acls.length === 0) {
                showAclsState($('emptyAclsState'));
            } else {
                acls.forEach(acl => {
                    const aclItem = $('aclItemTemplate').content.cloneNode(true);
                    const aclDiv = aclItem.querySelector('div');
                    aclDiv.querySelector('h3').textContent = acl.principal;
                    aclDiv.querySelector('.permission').textContent = acl.permission;
                    
                    const editButton = aclDiv.querySelector('.editAcl');
                    const deleteButton = aclDiv.querySelector('.deleteAcl');
                    
                    editButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showAclForm('Edit ACL', acl);
                    });
                    
                    deleteButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showConfirmation(
                            'Delete ACL',
                            `Are you sure you want to delete the ACL for ${acl.principal}? This action cannot be undone.`,
                            () => deleteAcl(scopeName, acl.principal)
                        );
                    });
                    
                    $('aclsList').appendChild(aclItem);
                });
                showAclsState($('aclsList'));
            }
        } catch (error) {
            $('aclsErrorMessage').textContent = error.message;
            showAclsState($('aclsErrorState'))
        }
    };

    const createAcl = async (scopeName, principal, permission) => {
        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/acls?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ principal, permission }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create ACL');
        }
    };

    const updateAcl = async (scopeName, principal, permission) => {
        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/acls/${encodeURIComponent(principal)}?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ permission }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update ACL');
        }
    };

    const deleteAcl = async (scopeName, principal) => {
        const workspaceHost = $('workspaceHost').value.trim();
        const pat = $('pat').value.trim();

        const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/acls/${encodeURIComponent(principal)}?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete ACL');
        }

        fetchAcls(scopeName);
    };

    $('addAcl').addEventListener('click', () => {
        showAclForm('Add ACL');
    });

    $('aclFormCancel').addEventListener('click', hideAclForm);

    $('aclForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        $('principalError').classList.add('hidden');
        $('permissionError').classList.add('hidden');
        
        const principal = $('aclPrincipal').value.trim();
        const permission = $('aclPermission').value;
        
        let hasError = false;
        if (!principal) {
            $('principalError').classList.remove('hidden');
            hasError = true;
        }
        if (!permission) {
            $('permissionError').classList.remove('hidden');
            hasError = true;
        }
        
        if (hasError) return;
        
        try {
            if (currentAclPrincipal) {
                await updateAcl(currentScope, currentAclPrincipal, permission);
            } else {
                await createAcl(currentScope, principal, permission);
            }
            hideAclForm();
            fetchAcls(currentScope);
        } catch (error) {
            $('aclsErrorMessage').textContent = error.message;
            showAclsState($('aclsErrorState'))
            hideAclForm();
        }
    });

}); 
