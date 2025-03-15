(comment) @comment

(keyword_statement [
        "call-script"
        "start-script"
        "set-signal-mask"
        "signal"
        "sleep"
        "set"
        "get"
        "spin"
        "around"
        "accelerate"
        "stop-spin"
        "decelerate"
        "now"
        "turn"
        "to"
        "speed"
        "move"
        "wait-for-turn"
        "around"
        "wait-for-move"
        "along"
        "hide"
        "show"
        "emit-sfx"
        "from"
        "explode"
        "attach-unit"
        "drop-unit"
    ]) @keyword

[
    "if"
    "else"
] @keyword.conditional

[
    "while"
] @keyword.repeat

(return_statement "return") @keyword.return

(constant) @number
((constant) @number.float (#any_of? @number.float "."))

(string_literal) @string
(preproc_include (string_literal)) @string.special.path
(system_lib_string) @string
(escape_sequence) @string.escape

[
    ";"
    ","
] @punctuation.delimiter

[
    "("
    ")"
    "["
    "]"
    "{"
    "}"
] @punctuation.bracket

[
    (var_name)
    (var_name_term)
] @variable

(piece_declaration "piece") @type
(static_var_declaration "static-var") @type

(piece_name) @constant
(axis) @constant.builtin

[
    "#if"
    "#ifdef"
    "#ifndef"
    "#else"
    "#elif"
    "#endif"
    "#elifdef"
    "#elifndef"
    (preproc_directive_name)
] @keyword.directive

"#define" @keyword.directive.define
(define_name) @constant.macro
(preproc_function_def (define_name) @function.macro)
(preproc_arg) @variable

"#include" @keyword.import

[
    "="
    "+"
    "-"
    "*"
    "/"
    "%"
    "^"
    "~"
    "!"
    "=="
    "!="
    "<"
    "<="
    ">"
    ">="
    "&&"
    "||"
    "^^"
    "++"
    "--"
] @operator

(function_declaration (func_name) @function)
(function_declaration (arg_name) @variable.parameter)

(call_script_statement (func_name) @function.call)
(start_script_statement (func_name) @function.call)