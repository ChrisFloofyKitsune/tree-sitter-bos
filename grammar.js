/**
 * @file DSL scripting language for controlling unit animations and state in the Recoil engine
 * @author ChrisFloofyKitsune <chrisfloofykitsune@gmail.com>
 * @license GPL-2.0
 */
const {PREC, c_rules, commaSep1, preprocIf, commaSep, preprocessor} = require("./c_grammar");

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

function laxCasing(str) {
    return alias(new RegExp(str.replaceAll('-', '-?'), 'i'), str);
}

function kw(keyword, ...rules) {
    let argRules = rules.map(rule => {
        // if regex or string, pass through
        if (typeof rule === 'string') {
            return prec(2, laxCasing(rule));
        } else if (rule instanceof RegExp) {
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
        field('keyword', laxCasing(keyword)),
        ...argRules,
        ';'
    ));
}

const commonPreprocNodes = ($) => [
    $.macro_name_statement,
    $.macro_call_statement,
    $.preproc_include,
    $.preproc_def,
    $.preproc_function_def,
    $.preproc_undef,
    $.preproc_line,
    $.preproc_directive,
]

module.exports = grammar({
    name: "bos",

    word: $ => $.identifier,

    conflicts: $ => [
        [$._block_item, $.statement],
        [$.get_call],
        [$.varying, $.preproc_call_expression]
    ],

    extras: $ => [
        /\s|\\\r?\n/,
        $.comment,
    ],

    inline: $ => [
        $._expression_not_binary,
        $.speed_or_now,
        $._var_name,
        $._piece_name,
        $._func_name,
        $._arg_name,
        $._define_name,
    ],

    supertypes: $ => [
        $.expression,
        $.preproc_expression,
        $.statement,
        $.keyword_statement,
        $.declaration,
        $.constant,
        $.varying,
    ],

    rules: {
        source_file: $ => repeat($._top_level_item),

        _top_level_item: $ => choice(
            $.declaration,
            alias($.preproc_if_top_level, $.preproc_if),
            alias($.preproc_ifdef_top_level, $.preproc_ifdef),
            ...commonPreprocNodes($),
            ';',
        ),

        _block_item: $ => choice(
            $.statement,
            $.preproc_if,
            $.preproc_ifdef,
            ...commonPreprocNodes($),
            ';',
        ),

        macro_name_statement: $ => seq(
            $._define_name,
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
            laxCasing('piece'),
            commaSep1(field("name", $._piece_name)),
            ';'
        )),

        static_var_declaration: $ => prec(10, seq(
            laxCasing('static-var'),
            commaSep1(field('name', $._var_name)),
            ';'
        )),

        function_declaration: $ => prec(10, seq(
            field("name", $._func_name),
            choice('()', seq('(', commaSep1(field("arg", $._arg_name)), ')')),
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
            laxCasing('var'),
            commaSep1($._var_name),
            ';'
        ),

        if_statement: $ => prec.left(seq(
            laxCasing('if'),
            '(',
            field("condition", $.expression),
            ')',
            field("then", $.statement),
            optional(seq(laxCasing('else'), field("else", $.statement))),
        )),

        while_statement: $ => seq(
            laxCasing('while'),
            '(',
            field("condition", $.expression),
            ')',
            field("body", $.statement),
        ),

        assign_statement: $ => choice(
            seq(field("name", $._var_name), '=', field("value", $.expression), ';'),
            $.increment_statement,
            $.decrement_statement,
        ),

        increment_statement: $ => seq(
            '++', field("name", $._var_name), ';'
        ),
        decrement_statement: $ => seq(
            '--', field("name", $._var_name), ';'
        ),

        return_statement: $ => seq(
            laxCasing('return'),
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
            kw('call-script', field('function', $._func_name), field('arguments', $.argument_list))
        ),
        start_script_statement: $ => choice(
            kw('start-script', field('function', $._func_name), field('arguments', $.argument_list)),
        ),
        signal_statement: $ => kw('signal', $.expression),

        set_signal_mask_statement: $ => kw('set-signal-mask', $.expression),
        sleep_statement: $ => kw('sleep', $.expression),

        set_statement: $ => kw('set', $.expression, 'to', $.expression),
        get_statement: $ => kw('get', field('call', $.get_call)),

        spin_statement: $ => kw(
            'spin', field('piece', $._piece_name), 'around', field('axis', $.axis), 'speed', $.expression,
            optional(seq('accelerate', $.expression))
        ),

        stop_spin_statement: $ => kw(
            'stop-spin', field('piece', $._piece_name), 'around', field('axis', $.axis),
            optional(seq('decelerate', $.expression))
        ),
        speed_or_now: $ => choice('now', seq('speed', $.expression)),

        turn_statement: $ => kw('turn', field('piece', $._piece_name), 'to', field('axis', $.axis), $.expression, $.speed_or_now),
        move_statement: $ => kw('move', field('piece', $._piece_name), 'to', field('axis', $.axis), $.expression, $.speed_or_now),
        wait_for_turn_statement: $ => kw('wait-for-turn', field('piece', $._piece_name), 'around', field('axis', $.axis),),

        wait_for_move_statement: $ => kw('wait-for-move', field('piece', $._piece_name), 'along', field('axis', $.axis),),
        hide_statement: $ => kw('hide', field('piece', $._piece_name)),

        show_statement: $ => kw('show', field('piece', $._piece_name)),
        emit_sfx_statement: $ => kw('emit-sfx', $.expression, 'from', field('piece', $._piece_name)),

        // play_sound_statement: $ => undefined,
        explode_statement: $ => kw('explode', field('piece', $._piece_name), 'type', $.expression),

        attach_unit_statement: $ => kw('attach-unit', $.expression, 'to', $.expression),
        drop_unit_statement: $ => kw('drop-unit', $.expression),

        cache_statement: $ => kw('cache', field('piece', $._piece_name)),
        dont_cache_statement: $ => kw('dont-cache', field('piece', $._piece_name)),
        shade_statement: $ => kw('shade', field('piece', $._piece_name)),
        dont_shade_statement: $ => kw('dont-shade', field('piece', $._piece_name)),
        dont_shadow_statement: $ => kw('dont-shadow', field('piece', $._piece_name)),

        expression: $ => choice(
            $._expression_not_binary,
            $.binary_expression,
        ),

        _expression_not_binary: $ => choice(
            $.parenthesized_expression,
            $._macro_call_expression,
            $.constant,
            $.varying,
            $.unary_expression,
            $.true,
            $.false,
        ),

        parenthesized_expression: $ => seq('(', $.expression, ')',),

        _macro_call_expression: $ => alias($.preproc_call_expression, $.macro_call_expression),

        get_term: $ => seq(laxCasing('get'), $.get_call),

        unary_expression: $ => prec.left(PREC.UNARY, seq(
            field('operator', alias(choice('!', /not/i), '!')),
            field('argument', $.expression),
        )),

        binary_expression: $ => {
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
                ['|', PREC.INCLUSIVE_OR],
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
            laxCasing('rand'),
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


        varying: $ => choice(
            $.rand_call,
            $.get_term,
            prec.dynamic(1, alias($._var_name, $.var_name_term)),
        ),

        constant: $ => choice(
            $.linear_constant,
            $.degree_constant,
            $.number_literal,
        ),

        linear_constant: $ => seq('[', choice($.number_literal, $.identifier), ']'),

        degree_constant: $ => seq('<', choice($.number_literal, $.identifier), '>'),
        identifier: _ => /[a-z_][a-z_0-9]*/i,

        _var_name: $ => alias($.identifier, $.var_name),
        _piece_name: $ => alias($.identifier, $.piece_name),
        _func_name: $ => alias($.identifier, $.func_name),
        _arg_name: $ => alias($.identifier, $.arg_name),
        _define_name: $ => alias($.identifier, $.define_name),

        ...c_rules,

        ...preprocIf("", $ => $._block_item),
        ...preprocIf("_top_level", $ => $._top_level_item),

        preproc_line: $ => seq(
            preprocessor('line'),
            field('lineno', $.number_literal),
            optional(field('filename', $.string_literal)),
            token.immediate(/\r?\n/),
        )
    }
});
