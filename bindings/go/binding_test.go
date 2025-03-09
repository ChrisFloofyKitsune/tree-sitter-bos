package tree_sitter_bos_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_bos "github.com/chrisfloofykitsune/tree-sitter-bos/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_bos.Language())
	if language == nil {
		t.Errorf("Error loading Bos Unit Animation Script grammar")
	}
}
