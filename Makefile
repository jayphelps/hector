# ==============================================================================
# Hector
# Copyright (c) 2012 Jay Phelps
# MIT licensed
# https://github.com/jayphelps/hector
# ==============================================================================

PROJECT_NAME = Hector
PARSER_NAME  = $(PROJECT_NAME).Parser
TARGET 	     = javascript/backbone

# Directories ==================================================================

SRC_DIR          = src
SPEC_DIR         = spec
NODE_MODULES_DIR = node_modules

TEMPLATE_DIR = src/targets/$(TARGET)/templates

PEGJS_DIR     = tools/pegjs
PEGJS_BIN_DIR = $(PEGJS_DIR)/bin
PEGJS_LIB_DIR = $(PEGJS_DIR)/lib
V8_DIR        = tools/v8/

# Files ========================================================================

GRAMMAR_FILE    = $(SPEC_DIR)/$(PROJECT_NAME).pegjs
PARSER_FILE     = $(SRC_DIR)/$(PARSER_NAME).js
ROOT_FILE       = $(SRC_DIR)/$(PROJECT_NAME).js
BUILDER_FILE    = $(SRC_DIR)/$(PROJECT_NAME).Builders.js
SRC_FILES       = $(ROOT_FILE) $(PARSER_FILE) $(BUILDER_FILE)
OUTPUT_FILE     = ./hector.js
OUTPUT_FILE_MIN = ./hector.min.js

TEMPLATES = Echo                 \
            Variable             \
            AttributeStatement   \
            AttributeDeclaration \
            ViewStatement        \
            ViewDeclaration      \

BUFFER = hector-buffer.js

# Executables ==================================================================

PEGJS    = $(PEGJS_BIN_DIR)/pegjs
D8       = $(V8_DIR)/out/native/d8
NODE     = node
UGLIFYJS = uglifyjs
INDENT   = sed 's/^/    /'
READLINK = bash tools/scripts/readlink.sh
CLEANTEMPLATE = bash tools/scripts/cleantemplate.sh

# Flags ==================================================================

PEGJS_FLAGS = --export-var $(PARSER_NAME)# --track-line-and-column

# Targets ======================================================================

# No default operation yet
all: pegjs parser build

# Build the compiler
build:
	@for srcFile in $(SRC_FILES); do \
	    cat $$srcFile >> $(BUFFER);  \
	    printf "\n\n" >> $(BUFFER);  \
	done
	@for templateName in $(TEMPLATES); do                                                  \
	    printf "$(PROJECT_NAME).Builders.templates[\"$$templateName\"] = \"" >> $(BUFFER); \
		$(READLINK) $(TEMPLATE_DIR)/$$templateName | xargs $(CLEANTEMPLATE)  >> $(BUFFER); \
	    printf "\";\n"                                                       >> $(BUFFER); \
	done
	@cat $(BUFFER) > $(OUTPUT_FILE)
	@rm -f $(BUFFER)
	@type -P $(UGLIFYJS) &>/dev/null && ($(UGLIFYJS) --unsafe --lift-vars -o $(OUTPUT_FILE_MIN) $(OUTPUT_FILE)) || echo "warning: uglifyjs not found, $(OUTPUT_FILE_MIN) not built."
	@echo "$(PROJECT_NAME).js built successfully."

# Remove built compiler by build
clean:
	@rm -f $(OUTPUT_FILE)

# Build the parser
parser:
	@$(PEGJS) $(PEGJS_FLAGS) $(GRAMMAR_FILE) $(PARSER_FILE)
	@echo "$(PROJECT_NAME) parser built successfully."

# Building PEG.js helper
pegjs:
	@cd $(PEGJS_DIR); \
	make parser
	@echo "PEG.js built successfully."

# Build Google V8
v8:
	@cd $(V8_DIR); \
	make dependencies; \
	make native.check