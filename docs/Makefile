# Minimal makefile for Sphinx documentation
#

# You can set these variables from the command line.
SPHINXOPTS    =
SPHINXBUILD   = sphinx-build
SPHINXPROJ    = blockchain-core
SOURCEDIR     = .
BUILDDIR      = _build

dbcpDocsUrl = "https://raw.githubusercontent.com/evannetwork/dbcp/develop/docs/"

# Put it first so that "make" without argument is like "make help".
help:
	@$(SPHINXBUILD) -M help "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

.PHONY: help Makefile

# Catch-all target: route all unknown targets to Sphinx using the new
# "make mode" option.  $(O) is meant as a shortcut for $(SPHINXOPTS).
%: Makefile
	# retrieve required docu files from dbcp
	wget  -P blockchain -N "$(dbcpDocsUrl)blockchain/account-store.rst"
	wget  -P blockchain -N "$(dbcpDocsUrl)blockchain/event-hub.rst"
	wget  -P blockchain -N "$(dbcpDocsUrl)blockchain/executor.rst"
	wget  -P blockchain -N "$(dbcpDocsUrl)blockchain/signer-internal.rst"
	wget  -P common -N "$(dbcpDocsUrl)common/logger.rst"
	wget  -P common -N "$(dbcpDocsUrl)common/validator.rst"
	wget  -P contracts -N "$(dbcpDocsUrl)contracts/contract-loader.rst"
	wget  -P dfs -N "$(dbcpDocsUrl)dfs/dfs-interface.rst"
	wget  -P encryption -N "$(dbcpDocsUrl)encryption/cryptor-unencrypted.rst"

	@$(SPHINXBUILD) -M $@ "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)