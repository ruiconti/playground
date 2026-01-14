CC = clang
CFLAGS = -Wall -Wextra -std=c17 -g
SRC_DIR = src
BIN_DIR = bin

# Build a specific file: make run FILE=example
run: $(SRC_DIR)/$(FILE).c
	$(CC) $(CFLAGS) -o $(BIN_DIR)/$(FILE) $< && ./$(BIN_DIR)/$(FILE)

# Build all .c files in src/
all:
	@for f in $(SRC_DIR)/*.c; do \
		name=$$(basename $$f .c); \
		$(CC) $(CFLAGS) -o $(BIN_DIR)/$$name $$f; \
	done

clean:
	rm -f $(BIN_DIR)/*

.PHONY: run all clean
