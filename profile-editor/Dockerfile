# The profile editor, pinned.
#
# What this image is for: handing the generator to an operator who does not have
# — and should not need — a checkout of this repository. The endpoint inventory
# is Python code inside the package, so the image tag *is* the version pin: an
# image built from tag X describes the frontend of tag X, and nothing else.
#
# Build from this directory:
#     docker build -t linagora/twake-mail-admin-profile-editor:dev profile-editor
#
# Run it, writing into the current directory as the current user:
#     docker run --rm -it -v "$PWD:/work" --user "$(id -u):$(id -g)" \
#         linagora/twake-mail-admin-profile-editor:dev --name domain-support --fr

FROM python:3.12-slim

ARG VERSION=dev
ARG REVISION=unknown

LABEL org.opencontainers.image.title="Twake Mail Admin profile editor" \
      org.opencontainers.image.description="Generates and reviews webadmin-proxy allowed.urls profiles" \
      org.opencontainers.image.source="https://github.com/linagora/twake-mail-admin" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

COPY pyproject.toml README.md UPSTREAM.md ./
COPY twake_profile_editor ./twake_profile_editor
RUN pip install --no-cache-dir --root-user-action=ignore . \
    && rm -rf /root/.cache

# Answers and profiles are written here; mount the operator's directory over it.
WORKDIR /work

ENTRYPOINT ["twake-profile-editor"]
CMD ["--help"]
