/**
 * @file DSL scripting language for controlling unit animations and state in the Recoil engine
 * @author ChrisFloofyKitsune <chrisfloofykitsune@gmail.com>
 * @license GPL-2.0
 */
const {PREC, c_rules, commaSep1, preprocIf, commaSep} = require("./c_grammar");

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

function kw(keyword, ...rules) {
    let argRules = rules.map(rule => {
        // if regex or string, pass through
        if (typeof rule === 'string' || rule instanceof RegExp) {
            return prec(2, rule);
        }

        // pass already labeled fields through
        if (rule.type === 'FIELD') {
            return prec(1, rule);
        }

        // otherwise, mark as argument
        return field(`argument`, rule);
    });

    return prec(PREC.CALL + 1, seq(
        field('keyword', prec(3, token(keyword))),
        ...argRules,
        ';'
    ));
}

module.exports = grammar({
    name: "bos",

    word: $ => $.identifier,

    conflicts: $ => [
        [$._block_item, $.statement],
        [$.get_call],
        [$._varying, $.preproc_call_expression]
    ],

    extras: $ => [
        /\s|\\\r?\n/,
        $.comment,
    ],

    inline: $ => [
        $._expression_not_binary,
        $.speed_or_now,
    ],

    supertypes: $ => [
        $.expression,
        $.statement,
        $.keyword_statement,
        $.declaration,
    ],

    rules: {
        source_file: $ => repeat($._top_level_item),

        _top_level_item: $ => choice(
            $.declaration,
            $.macro_name_statement,
            $.macro_call_statement,
            alias($.preproc_if_top_level, $.preproc_if),
            alias($.preproc_ifdef_top_level, $.preproc_ifdef),
            $.preproc_include,
            $.preproc_def,
            $.preproc_function_def,
            $.preproc_call,
            ';',
        ),

        _block_item: $ => choice(
            $.statement,
            $.macro_name_statement,
            $.macro_call_statement,
            $.preproc_if,
            $.preproc_ifdef,
            $.preproc_include,
            $.preproc_def,
            $.preproc_function_def,
            $.preproc_call,
            ';',
        ),

        macro_name_statement: $ => seq(
            $.identifier,
            optional(';'),
            token.immediate(/\r?\n/),
        ),

        macro_call_statement: $ => prec(PREC.CALL, seq(
            $._macro_call_expression,
            optional(';'),
            token.immediate(/\r?\n/),
        )),

        declaration: $ => prec(10, choice(
            $.piece_declaration,
            $.static_var_declaration,
            $.function_declaration
        )),

        piece_declaration: $ => prec(10, seq(
            /piece/i,
            commaSep1(field("name", $.identifier)),
            ';'
        )),

        static_var_declaration: $ => prec(10, seq(
            /static-?var/i,
            commaSep1(field('name', $.identifier)),
            ';'
        )),

        function_declaration: $ => prec(10, seq(
            field("name", $.identifier),
            choice('()', seq('(', commaSep1(field("arg", $.identifier)), ')')),
            field("body", $.compound_statement),
        )),

        compound_statement: $ => seq(
            '{',
            repeat($._block_item),
            '}',
        ),

        statement: $ => choice(
            $.compound_statement,
            $.keyword_statement,
            $.var_statement,
            $.if_statement,
            $.while_statement,
            $.assign_statement,
            $.return_statement,
            ';',
        ),

        var_statement: $ => seq(
            /var/i,
            commaSep1($.identifier),
            ';'
        ),

        if_statement: $ => prec.left(seq(
            /if/i,
            '(',
            field("condition", $.expression),
            ')',
            field("then", $.statement),
            optional(seq(/else/i, field("else", $.statement))),
        )),

        while_statement: $ => seq(
            /while/i,
            '(',
            field("condition", $.expression),
            ')',
            field("body", $.statement),
        ),

        assign_statement: $ => choice(
            seq(field("name", $.identifier), '=', field("value", $.expression), ';'),
            $.increment_statement,
            $.decrement_statement,
        ),

        increment_statement: $ => seq(
            '++', field("name", $.identifier), ';'
        ),
        decrement_statement: $ => seq(
            '--', field("name", $.identifier), ';'
        ),

        return_statement: $ => seq(
            /return/i,
            optional($.expression),
            ';'
        ),

        keyword_statement: $ => prec.left(11, choice(
            $.call_script_statement,
            $.start_script_statement,

            $.signal_statement,
            $.set_signal_mask_statement,

            $.sleep_statement,

            $.set_statement,
            $.get_statement,

            $.spin_statement,
            $.stop_spin_statement,

            $.turn_statement,
            $.move_statement,

            $.wait_for_turn_statement,
            $.wait_for_move_statement,

            $.hide_statement,
            $.show_statement,

            // $.play_sound_statement,
            $.emit_sfx_statement,
            $.explode_statement,

            $.attach_unit_statement,
            $.drop_unit_statement,

            $.cache_statement,
            $.dont_cache_statement,
            $.dont_shadow_statement,
            $.dont_shade_statement,
        )),

        axis: _ => choice(
            /x-?axis/i, /y-?axis/i, /z-?axis/i
        ),

        argument_list: $ => seq(
            '(',
            commaSep($.expression),
            ')',
        ),

        call_script_statement: $ => choice(
            kw(/call-?script/i, field('function', $.identifier), field('arguments', $.argument_list))
        ),
        start_script_statement: $ => choice(
            kw(/start-?script/i, field('function', $.identifier), field('arguments', $.argument_list)),
        ),
        signal_statement: $ => kw(/signal/i, $.expression),

        set_signal_mask_statement: $ => kw(/set-?signal-?mask/i, $.expression),
        sleep_statement: $ => kw(/sleep/i, $.expression),

        set_statement: $ => kw(/set/i, $.expression, /to/i, $.expression),

        get_statement: $ => kw(/get/i, field('call', $.get_call)),
        spin_statement: $ => kw(
            /spin/i, field('piece', $.identifier), /around/i, field('axis', $.axis), /speed/i, $.expression,
            optional(seq(/accelerate/i, $.expression))
        ),

        stop_spin_statement: $ => kw(
            /stop-?spin/i, field('piece', $.identifier), /around/i, field('axis', $.axis),
            optional(seq(/decelerate/i, $.expression))
        ),
        speed_or_now: $ => choice(/now/i, seq(/speed/i, $.expression)),

        turn_statement: $ => kw(/turn/i, field('piece', $.identifier), /to/i, field('axis', $.axis), $.expression, $.speed_or_now),
        move_statement: $ => kw(/move/i, field('piece', $.identifier), /to/i, field('axis', $.axis), $.expression, $.speed_or_now),
        wait_for_turn_statement: $ => kw(/wait-?for-?turn/i, field('piece', $.identifier), /around/i, field('axis', $.axis),),

        wait_for_move_statement: $ => kw(/wait-?for-?move/i, field('piece', $.identifier), /along/i, field('axis', $.axis),),
        hide_statement: $ => kw(/hide/i, field('piece', $.identifier)),

        show_statement: $ => kw(/show/i, field('piece', $.identifier)),
        emit_sfx_statement: $ => kw(/emit-?sfx/i, $.expression, /from/i, field('piece', $.identifier)),

        // play_sound_statement: $ => undefined,
        explode_statement: $ => kw(/explode/i, field('piece', $.identifier), /type/i, $.expression),

        attach_unit_statement: $ => kw(/attach-?unit/i, $.expression, /to/i, $.expression),
        drop_unit_statement: $ => kw(/drop-?unit/i, $.expression),

        cache_statement: $ => kw(/cache/i, field('piece', $.identifier)),
        dont_cache_statement: $ => kw(/dont-?cache/i, field('piece', $.identifier)),
        shade_statement: $ => kw(/shade/i, field('piece', $.identifier)),
        dont_shade_statement: $ => kw(/dont-?shade/i, field('piece', $.identifier)),
        dont_shadow_statement: $ => kw(/dont-?shadow/i, field('piece', $.identifier)),

        expression: $ => choice(
            $._expression_not_binary,
            $.binary_expression,
        ),

        _expression_not_binary: $ => choice(
            $.parenthesized_expression,
            $._macro_call_expression,
            $._constant,
            $._varying,
            $.unary_expression,
            $.true,
            $.false,
        ),

        parenthesized_expression: $ => seq('(', $.expression, ')',),

        _macro_call_expression: $ => alias($.preproc_call_expression, $.macro_call_expression),

        get_term: $ => seq(/get/i, $.get_call),

        unary_expression: $ => prec.left(PREC.UNARY, seq(
            field('operator', choice('!', /not/i)),
            field('argument', $.expression),
        )),

        binary_expression: $ => {
            const table = [
                ['+', PREC.ADD],
                ['-', PREC.ADD],
                ['*', PREC.MULTIPLY],
                ['/', PREC.MULTIPLY],
                ['%', PREC.MULTIPLY],
                [alias(choice('||', /or/i), '||'), PREC.LOGICAL_OR],
                [alias(choice('&&', /and/i), '&&'), PREC.LOGICAL_AND],
                ['|', PREC.INCLUSIVE_OR],
                ['^', PREC.EXCLUSIVE_OR],
                ['&', PREC.BITWISE_AND],
                ['==', PREC.EQUAL],
                ['!=', PREC.EQUAL],
                ['>', PREC.RELATIONAL],
                ['>=', PREC.RELATIONAL],
                ['<=', PREC.RELATIONAL],
                ['<', PREC.RELATIONAL],
                // ['<<', PREC.SHIFT],
                // ['>>', PREC.SHIFT],
            ];

            return choice(...table.map(([operator, precedence]) => {
                return prec.left(precedence, seq(
                    field('left', $.expression),
                    // @ts-ignore
                    field('operator', operator),
                    field('right', $.expression),
                ));
            }));
        },

        rand_call: $ => seq(
            /rand/i,
            '(',
            field('lower_bound', $.expression),
            ',',
            field('upper_bound', $.expression),
            ')'
        ),

        get_call: $ => choice(
            field('value_index', $.expression),
            seq(field('value_index', $.expression),
                '(',
                field('arg', $.expression),
                optional(seq(',', field('arg', $.expression))),
                optional(seq(',', field('arg', $.expression))),
                optional(seq(',', field('arg', $.expression))),
                ')'
            ),
        ),

        _varying: $ => choice(
            $.rand_call,
            $.get_term,
            prec.dynamic(1, $.identifier),
        ),

        _constant: $ => choice(
            $.linear_constant,
            $.degree_constant,
            $.number_literal,
        ),

        linear_constant: $ => seq('[', choice($.number_literal, $.identifier), ']'),

        degree_constant: $ => seq('<', choice($.number_literal, $.identifier), '>'),
        identifier: $ => /[a-z_][a-z_0-9]*/i,

        ...c_rules,

        ...preprocIf("", $ => $._block_item),
        ...preprocIf("_top_level", $ => $._top_level_item),
    }
});
