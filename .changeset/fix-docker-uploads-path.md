---
"@dm-hero/app": patch
---

fix: persist uploaded files in docker — `docker-compose.yml` and the dockerfile now use `/app/uploads`, which is where the server actually writes. previously uploads landed in a directory that was not the docker volume mount and were lost on container restart.
