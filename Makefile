DATABRICKS_APP_NAME ?= vaultabricks

.PHONY: databricks-app-sync
databricks-app-sync:
	poetry export --without-hashes --format=requirements.txt > src/requirements.txt
	cp app.yml src/app.yml
	databricks sync ./src ${DATABRICKS_PATH}
	rm src/app.yml
	rm src/requirements.txt

.PHONY: databricks-app-sync
databricks-app-deploy:
	databricks apps deploy ${DATABRICKS_APP_NAME} --source-code-path ${DATABRICKS_PATH}
