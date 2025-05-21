document.addEventListener('DOMContentLoaded', () => {
    const workspaceHostInput = document.getElementById('workspaceHost');
    const patInput = document.getElementById('pat');
    const toggleLock = document.getElementById('toggleLock');
    const refreshButton = document.getElementById('refreshScopes');
    const backToScopesButton = document.getElementById('backToScopes');
    const refreshSecretsButton = document.getElementById('refreshSecrets');
    const addSecretButton = document.getElementById('addSecret');
    const scopeDetailsView = document.getElementById('scopeDetails');
    const scopeNameElement = document.getElementById('scopeName');
    const secretsList = document.getElementById('secretsList');
    const emptySecretsState = document.getElementById('emptySecretsState');
    const secretsErrorState = document.getElementById('secretsErrorState');
    const secretsErrorMessage = document.getElementById('secretsErrorMessage');
    const secretItemTemplate = document.getElementById('secretItemTemplate');
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationTitle = document.getElementById('confirmationTitle');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmationCancel = document.getElementById('confirmationCancel');
    const confirmationConfirm = document.getElementById('confirmationConfirm');
    const secretFormModal = document.getElementById('secretFormModal');
    const secretFormTitle = document.getElementById('secretFormTitle');
    const secretForm = document.getElementById('secretForm');
    const secretFormCancel = document.getElementById('secretFormCancel');
    const secretKeyInput = document.getElementById('secretKey');
    const secretValueInput = document.getElementById('secretValue');
    let isLocked = false;
    let currentScope = '';
    let currentSecret = null;

    // State elements
    const initialState = document.getElementById('initialState');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const emptyState = document.getElementById('emptyState');
    const scopesList = document.getElementById('scopesList');
    const errorMessage = document.getElementById('errorMessage');
    const scopesGrid = document.getElementById('scopesGrid');
    const scopeItemTemplate = document.getElementById('scopeItemTemplate');

    // ACL Management
    let currentAclPrincipal = null;

    // Show only one state at a time
    const showState = (state) => {
        [initialState, loadingState, errorState, emptyState, scopesList, scopeDetailsView].forEach(el => {
            el.classList.add('hidden');
        });
        state.classList.remove('hidden');
    };

    // Show only one secrets state at a time
    const showSecretsState = (state) => {
        [secretsList, emptySecretsState, secretsErrorState].forEach(el => {
            el.classList.add('hidden');
        });
        state.classList.remove('hidden');
    };

    // Show confirmation modal
    const showConfirmation = (title, message, onConfirm) => {
        confirmationTitle.textContent = title;
        confirmationMessage.textContent = message;
        confirmationModal.classList.remove('hidden');
        
        const handleConfirm = () => {
            confirmationModal.classList.add('hidden');
            onConfirm();
            confirmationConfirm.removeEventListener('click', handleConfirm);
            confirmationCancel.removeEventListener('click', handleCancel);
        };

        const handleCancel = () => {
            confirmationModal.classList.add('hidden');
            confirmationConfirm.removeEventListener('click', handleConfirm);
            confirmationCancel.removeEventListener('click', handleCancel);
        };

        confirmationConfirm.addEventListener('click', handleConfirm);
        confirmationCancel.addEventListener('click', handleCancel);
    };

    // Show secret form modal
    const showSecretForm = (title, secret = null) => {
        currentSecret = secret;
        secretFormTitle.textContent = title;
        secretKeyInput.value = secret ? secret.key : '';
        secretValueInput.value = '';
        secretValueInput.placeholder = secret ? '****redacted****' : '';
        secretKeyInput.disabled = !!secret;
        // Reset error states
        document.getElementById('keyError').classList.add('hidden');
        document.getElementById('valueError').classList.add('hidden');
        secretFormModal.classList.remove('hidden');
    };

    // Hide secret form modal
    const hideSecretForm = () => {
        secretFormModal.classList.add('hidden');
        secretForm.reset();
        currentSecret = null;
    };

    // Validate workspace host URL
    const validateWorkspaceHost = (host) => {
        try {
            const url = new URL(host);
            return url.protocol === 'https:' && url.hostname.endsWith('.databricks.com');
        } catch {
            return false;
        }
    };

    // Validate PAT format (should be a 32 character hex string)
    const validatePAT = (pat) => {
        return /^dapi[a-fA-F0-9]{32}$/.test(pat);
    };

    toggleLock.addEventListener('click', () => {
        isLocked = !isLocked;
        patInput.disabled = isLocked;
        workspaceHostInput.disabled = isLocked;
        toggleLock.innerHTML = isLocked 
            ? '<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>'
            : '<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>';
    });

    // Fetch scopes function that can be called from anywhere
    const fetchScopes = async () => {
        const workspaceHost = workspaceHostInput.value.trim();
        const pat = patInput.value.trim();

        if (!workspaceHost || !pat) {
            showState(initialState);
            return;
        }

        // Validate inputs
        if (!validateWorkspaceHost(workspaceHost)) {
            errorMessage.textContent = 'Invalid workspace host URL. Must be a valid Databricks workspace URL (e.g., https://your-workspace.cloud.databricks.com)';
            showState(errorState);
            return;
        }

        if (!validatePAT(pat)) {
            errorMessage.textContent = 'Invalid PAT format. Must be a 32 character hex string.';
            showState(errorState);
            return;
        }

        try {
            showState(loadingState);
            
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
                showState(emptyState);
                return;
            }

            // Clear previous scopes
            scopesGrid.innerHTML = '';
            
            // Add new scopes
            scopes.forEach(scope => {
                const scopeItem = scopeItemTemplate.content.cloneNode(true);
                const scopeDiv = scopeItem.querySelector('div');
                scopeDiv.dataset.scopeName = scope;
                scopeDiv.querySelector('h3').textContent = scope;
                scopeDiv.addEventListener('click', () => showScopeDetails(scope));
                scopesGrid.appendChild(scopeItem);
            });

            showState(scopesList);
        } catch (error) {
            errorMessage.textContent = error.message;
            showState(errorState);
        }
    };

    // Fetch secrets for a scope
    const fetchSecrets = async (scopeName) => {
        const workspaceHost = workspaceHostInput.value.trim();
        const pat = patInput.value.trim();

        try {
            showState(loadingState);
            
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
            
            // Clear previous secrets
            secretsList.innerHTML = '';
            
            if (secrets.length === 0) {
                showSecretsState(emptySecretsState);
            } else {
                // Add new secrets
                secrets.forEach(secret => {
                    const secretItem = secretItemTemplate.content.cloneNode(true);
                    secretItem.querySelector('h3').textContent = secret.key;
                    secretItem.querySelector('.lastUpdated').textContent = secret.last_updated 
                        ? new Date(parseInt(secret.last_updated)).toLocaleString() 
                        : 'Never';
                    
                    // Add event listeners for edit and delete
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
                    
                    secretsList.appendChild(secretItem);
                });
                showSecretsState(secretsList);
            }

            showState(scopeDetailsView);
        } catch (error) {
            secretsErrorMessage.textContent = error.message;
            showSecretsState(secretsErrorState);
            showState(scopeDetailsView);
        }
    };

    // Create a new secret
    const createSecret = async (scopeName, key, value) => {
        const workspaceHost = workspaceHostInput.value.trim();
        const pat = patInput.value.trim();

        try {
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

            hideSecretForm();
            fetchSecrets(scopeName);
        } catch (error) {
            secretsErrorMessage.textContent = error.message;
            showSecretsState(secretsErrorState);
        }
    };

    // Update an existing secret
    const updateSecret = async (scopeName, key, value) => {
        const workspaceHost = workspaceHostInput.value.trim();
        const pat = patInput.value.trim();

        try {
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

            hideSecretForm();
            fetchSecrets(scopeName);
        } catch (error) {
            secretsErrorMessage.textContent = error.message;
            showSecretsState(secretsErrorState);
        }
    };

    // Delete a secret
    const deleteSecret = async (scopeName, key) => {
        const workspaceHost = workspaceHostInput.value.trim();
        const pat = patInput.value.trim();

        try {
            const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/secrets/${encodeURIComponent(key)}?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete secret');
            }

            fetchSecrets(scopeName);
        } catch (error) {
            secretsErrorMessage.textContent = error.message;
            showSecretsState(secretsErrorState);
        }
    };

    // Show scope details view
    const showScopeDetails = (scopeName) => {
        currentScope = scopeName;
        scopeNameElement.textContent = scopeName;
        fetchSecrets(scopeName);
        fetchAcls(scopeName);
    };

    // Event listeners
    workspaceHostInput.addEventListener('change', fetchScopes);
    patInput.addEventListener('change', fetchScopes);
    refreshButton.addEventListener('click', fetchScopes);
    backToScopesButton.addEventListener('click', () => {
        showState(scopesList);
    });
    refreshSecretsButton.addEventListener('click', () => {
        fetchSecrets(currentScope);
        fetchAcls(currentScope);
    });

    // Secret management event listeners
    addSecretButton.addEventListener('click', () => {
        showSecretForm('Add Secret');
    });

    secretFormCancel.addEventListener('click', hideSecretForm);

    secretForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = secretKeyInput.value.trim();
        const value = secretValueInput.value.trim();
        let hasError = false;

        // Reset error states
        document.getElementById('keyError').classList.add('hidden');
        document.getElementById('valueError').classList.add('hidden');

        // Validate key
        if (!key) {
            document.getElementById('keyError').classList.remove('hidden');
            hasError = true;
        }

        // Validate value
        if (!value || value === '****redacted****') {
            document.getElementById('valueError').classList.remove('hidden');
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
            secretsErrorMessage.textContent = error.message;
            showSecretsState(secretsErrorState);
        }
    });

    // Show ACL form modal
    const showAclForm = (title, acl = null) => {
        currentAclPrincipal = acl ? acl.principal : null;
        document.getElementById('aclFormTitle').textContent = title;
        document.getElementById('aclPrincipal').value = acl ? acl.principal : '';
        document.getElementById('aclPrincipal').disabled = !!acl;
        document.getElementById('aclPermission').value = acl ? acl.permission : '';
        document.getElementById('aclFormSubmit').textContent = acl ? 'Update' : 'Create';
        // Reset error states
        document.getElementById('principalError').classList.add('hidden');
        document.getElementById('permissionError').classList.add('hidden');
        document.getElementById('aclFormModal').classList.remove('hidden');
    };

    // Hide ACL form modal
    const hideAclForm = () => {
        document.getElementById('aclFormModal').classList.add('hidden');
        document.getElementById('aclForm').reset();
        currentAclPrincipal = null;
    };

    // Fetch ACLs for a scope
    const fetchAcls = async (scopeName) => {
        const workspaceHost = workspaceHostInput.value.trim();
        const pat = patInput.value.trim();

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
            
            // Clear previous ACLs
            const aclsList = document.getElementById('aclsList');
            aclsList.innerHTML = '';
            
            if (acls.length === 0) {
                document.getElementById('emptyAclsState').classList.remove('hidden');
                document.getElementById('aclsList').classList.add('hidden');
            } else {
                document.getElementById('emptyAclsState').classList.add('hidden');
                document.getElementById('aclsList').classList.remove('hidden');
                
                // Add new ACLs
                acls.forEach(acl => {
                    const aclItem = document.getElementById('aclItemTemplate').content.cloneNode(true);
                    const aclDiv = aclItem.querySelector('div');
                    aclDiv.querySelector('h3').textContent = acl.principal;
                    aclDiv.querySelector('.permission').textContent = acl.permission;
                    
                    // Add event listeners for edit and delete
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
                    
                    aclsList.appendChild(aclItem);
                });
            }
        } catch (error) {
            document.getElementById('aclsErrorState').classList.remove('hidden');
            document.getElementById('aclsErrorMessage').textContent = error.message;
        }
    };

    // Create a new ACL
    const createAcl = async (scopeName, principal, permission) => {
        const workspaceHost = workspaceHostInput.value.trim();
        const pat = patInput.value.trim();

        try {
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

            hideAclForm();
            fetchAcls(scopeName);
        } catch (error) {
            document.getElementById('aclsErrorState').classList.remove('hidden');
            document.getElementById('aclsErrorMessage').textContent = error.message;
        }
    };

    // Update an existing ACL
    const updateAcl = async (scopeName, principal, permission) => {
        const workspaceHost = workspaceHostInput.value.trim();
        const pat = patInput.value.trim();

        try {
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

            hideAclForm();
            fetchAcls(scopeName);
        } catch (error) {
            document.getElementById('aclsErrorState').classList.remove('hidden');
            document.getElementById('aclsErrorMessage').textContent = error.message;
        }
    };

    // Delete an ACL
    const deleteAcl = async (scopeName, principal) => {
        const workspaceHost = workspaceHostInput.value.trim();
        const pat = patInput.value.trim();

        try {
            const response = await fetch(`/api/scopes/${encodeURIComponent(scopeName)}/acls/${encodeURIComponent(principal)}?workspace_host=${encodeURIComponent(workspaceHost)}&pat=${encodeURIComponent(pat)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete ACL');
            }

            fetchAcls(scopeName);
        } catch (error) {
            document.getElementById('aclsErrorState').classList.remove('hidden');
            document.getElementById('aclsErrorMessage').textContent = error.message;
        }
    };

    // Add event listeners for ACL management
    document.getElementById('addAcl').addEventListener('click', () => {
        showAclForm('Add ACL');
    });

    document.getElementById('aclFormCancel').addEventListener('click', hideAclForm);

    document.getElementById('aclForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset error states
        document.getElementById('principalError').classList.add('hidden');
        document.getElementById('permissionError').classList.add('hidden');
        
        const principal = document.getElementById('aclPrincipal').value.trim();
        const permission = document.getElementById('aclPermission').value;
        
        // Validate inputs
        let hasError = false;
        if (!principal) {
            document.getElementById('principalError').classList.remove('hidden');
            hasError = true;
        }
        if (!permission) {
            document.getElementById('permissionError').classList.remove('hidden');
            hasError = true;
        }
        
        if (hasError) return;
        
        try {
            if (currentAclPrincipal) {
                await updateAcl(currentScope, currentAclPrincipal, permission);
            } else {
                await createAcl(currentScope, principal, permission);
            }
        } catch (error) {
            document.getElementById('aclsErrorState').classList.remove('hidden');
            document.getElementById('aclsErrorMessage').textContent = error.message;
        }
    });
}); 
