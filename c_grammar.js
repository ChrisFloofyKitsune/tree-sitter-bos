/*

Shamelessly copied from tree-sitter-c/grammar.js
https://github.com/tree-sitter/tree-sitter-c/blob/master/grammar.js

The MIT License (MIT)

Copyright (c) 2014 Max Brunsfeld

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const PREC = {
    PAREN_DECLARATOR: -10,
    ASSIGNMENT: -2,
    CONDITIONAL: -1,
    DEFAULT: 0,
    LOGICAL_XOR: 1,
    LOGICAL_OR: 2,
    LOGICAL_AND: 3,
    EXCLUSIVE_OR: 4,
    INCLUSIVE_OR: 5,
    BITWISE_AND: 6,
    EQUAL: 7,
    RELATIONAL: 8,
    SHIFT: 9,
    ADD: 10,
    MULTIPLY: 11,
    CAST: 12,
    SIZEOF: 13,
    UNARY: 14,
    CALL: 15,
    FIELD: 16,
    SUBSCRIPT: 17,
};

module.exports.c_rules = {
    // Preprocessor

    preproc_arg: _ => token(prec(-1, /\S([^/\n]|\/[^*]|\\\r?\n)*/)),

    preproc_include: $ => seq(
        preprocessor('include'),
        field('path', choice(
            $.string_literal,
            $.system_lib_string,
            $._define_name,
            $.preproc_call_expression,
        )),
        token.immediate(/\r?\n/),
    ),

    preproc_def: $ => seq(
        preprocessor('define'),
        field('name', $._define_name),
        field('value', optional($.preproc_arg)),
        token.immediate(/\r?\n/),
    ),

    preproc_function_def: $ => seq(
        preprocessor('define'),
        field('name', $._define_name),
        field('parameters', $.preproc_params),
        field('value', optional($.preproc_arg)),
        token.immediate(/\r?\n/),
    ),

    preproc_params: $ => seq(
        token.immediate('('), commaSep(choice($.identifier, '...')), ')',
    ),

    preproc_undef: $ => seq(
        preprocessor('undef'),
        field('name', $._define_name),
        token.immediate(/\r?\n/),
    ),

    preproc_directive: $ => seq(
        field('directive', $.preproc_directive_name),
        field('argument', optional($.preproc_arg)),
        token.immediate(/\r?\n/),
    ),

    preproc_directive_name: _ => token(prec(-1, /#[ \t]*[a-zA-Z0-9]\w*/)),


    preproc_expression: $ => choice(
        $._define_name,
        $.preproc_call_expression,
        $.constant,
        $.preproc_defined,
        $.preproc_unary_expression,
        $.preproc_binary_expression,
        $.preproc_parenthesized_expression,
    ),

    preproc_call_expression: $ => prec.dynamic(-1, seq(
        field('function', $._define_name),
        field('arguments', $.preproc_argument_list),
    )),

    preproc_argument_list: $ => seq(
        '(',
        commaSep($.preproc_expression),
        ')',
    ),

    preproc_defined: $ => choice(
        prec(PREC.CALL, seq('defined', '(', $._define_name, ')')),
        seq('defined', $._define_name),
    ),

    preproc_unary_expression: $ => prec.left(PREC.UNARY, seq(
        field('operator', choice(alias(choice('!', /not/i), '!'), '~', '-', '+')),
        field('argument', $.preproc_expression),
    )),

    preproc_binary_expression: $ => {
        const table = [
            ['+', PREC.ADD],
            ['-', PREC.ADD],
            ['*', PREC.MULTIPLY],
            ['/', PREC.MULTIPLY],
            ['%', PREC.MULTIPLY],
            [alias(choice('^^', /xor/i), '^^'), PREC.LOGICAL_XOR],
            [alias(choice('||', /or/i), '||'), PREC.LOGICAL_OR],
            [alias(choice('&&', /and/i), '&&'), PREC.LOGICAL_AND],
            ['^', PREC.EXCLUSIVE_OR],
            ['&', PREC.BITWISE_AND],
            ['==', PREC.EQUAL],
            ['!=', PREC.EQUAL],
            ['>', PREC.RELATIONAL],
            ['>=', PREC.RELATIONAL],
            ['<=', PREC.RELATIONAL],
            ['<', PREC.RELATIONAL],
            ['<<', PREC.SHIFT],
            ['>>', PREC.SHIFT],
        ];

        return choice(...table.map(([operator, precedence]) => {
            return prec.left(precedence, seq(
                field('left', $.preproc_expression),
                // @ts-ignore
                field('operator', operator),
                field('right', $.preproc_expression),
            ));
        }));
    },

    preproc_parenthesized_expression: $ => seq(
        '(',
        $.preproc_expression,
        ')',
    ),

    number_literal: _ => {
        const separator = /['_]/;
        const hex = /[0-9a-fA-F]/;
        const decimal = /[0-9]/;
        const hexDigits = seq(repeat1(hex), repeat(seq(separator, repeat1(hex))));
        const decimalDigits = seq(repeat1(decimal), repeat(seq(separator, repeat1(decimal))));
        return token(seq(
            optional(/[-+]/),
            optional(choice(/0[xX]/, /0[bB]/)),
            choice(
                seq(
                    choice(
                        decimalDigits,
                        seq(/0[xX]/, hexDigits),
                    ),
                    optional(seq('.', optional(hexDigits))),
                ),
                seq('.', decimalDigits),
            ),
            /[fF]*/,
        ));
    },

    string_literal: $ => seq(
        '"',
        repeat(choice(
            alias(token.immediate(prec(1, /[^\\"\n]+/)), $.string_content),
            $.escape_sequence,
        )),
        '"',
    ),

    escape_sequence: _ => token(prec(1, seq(
        '\\',
        choice(
            /[^xuU]/,
            /\d{2,3}/,
            /x[0-9a-fA-F]{1,4}/,
            /u[0-9a-fA-F]{4}/,
            /U[0-9a-fA-F]{8}/,
        ),
    ))),

    system_lib_string: _ => token(seq(
        '<',
        repeat(choice(/[^>\n]/, '\\>')),
        '>',
    )),

    true: _ => token(choice('TRUE', 'true')),
    false: _ => token(choice('FALSE', 'false')),

    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    comment: _ => token(choice(
        seq('//', /(\\+(.|\r?\n)|[^\\\n])*/),
        seq(
            '/*',
            /[^*]*\*+([^/*][^*]*\*+)*/,
            '/',
        ),
    )),

}

/**
 *
 * @param {string} suffix
 *
 * @param {RuleBuilder<string>} content
 *
 * @param {number} precedence
 *
 * @returns {RuleBuilders<string, string>}
 */
function preprocIf(suffix, content, precedence = 0) {
    /**
     *
     * @param {GrammarSymbols<string>} $
     *
     * @returns {ChoiceRule}
     */
    function alternativeBlock($) {
        return choice(
            suffix ? alias($['preproc_else' + suffix], $.preproc_else) : $.preproc_else,
            suffix ? alias($['preproc_elif' + suffix], $.preproc_elif) : $.preproc_elif,
            suffix ? alias($['preproc_elifdef' + suffix], $.preproc_elifdef) : $.preproc_elifdef,
        );
    }

    return {
        ['preproc_if' + suffix]: $ => prec(precedence, seq(
            preprocessor('if'),
            field('condition', $.preproc_expression),
            '\n',
            field('body', repeat(content($))),
            field('alternative', optional(alternativeBlock($))),
            preprocessor('endif'),
        )),

        ['preproc_ifdef' + suffix]: $ => prec(precedence, seq(
            choice(preprocessor('ifdef'), preprocessor('ifndef')),
            field('name', $._define_name),
            field('body', repeat(content($))),
            field('alternative', optional(alternativeBlock($))),
            preprocessor('endif'),
        )),

        ['preproc_else' + suffix]: $ => prec(precedence, seq(
            preprocessor('else'),
            field('body', repeat(content($))),
        )),

        ['preproc_elif' + suffix]: $ => prec(precedence, seq(
            preprocessor('elif'),
            field('condition', $.preproc_expression),
            '\n',
            field('body', repeat(content($))),
            field('alternative', optional(alternativeBlock($))),
        )),

        ['preproc_elifdef' + suffix]: $ => prec(precedence, seq(
            choice(preprocessor('elifdef'), preprocessor('elifndef')),
            field('name', $._define_name),
            field('body', repeat(content($))),
            field('alternative', optional(alternativeBlock($))),
        )),
    };
}

/**
 * Creates a preprocessor regex rule
 *
 * @param {RegExp | Rule | string} command
 *
 * @returns {AliasRule}
 */
function preprocessor(command) {
    return alias(new RegExp('#[ \t]*' + command), '#' + command);
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
    return optional(commaSep1(rule));
}

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
    return seq(rule, repeat(seq(',', rule)));
}

module.exports.PREC = PREC;
module.exports.preprocIf = preprocIf;
module.exports.preprocessor = preprocessor;
module.exports.commaSep = commaSep;
module.exports.commaSep1 = commaSep1;