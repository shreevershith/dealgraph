# Memgraph for Railway (Option B — same project as backend).
# Same image and Bolt compatibility flag as docker-compose.yml.
FROM memgraph/memgraph:latest
# Neo4j driver compatibility (Bolt handshake)
CMD ["--bolt-server-name-for-init=Neo4j/"]
EXPOSE 7687
