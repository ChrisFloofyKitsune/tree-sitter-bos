/**
 * @file DSL scripting language for controlling unit animations and state in the Recoil engine
 * @author ChrisFloofyKitsune <chrisfloofykitsune@gmail.com>
 * @license GPL-2.0
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)))
}

function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule))
}

function kw(keyword, ...rules) {
  let argIndex = 1;
  let argRules = rules.map(rule => {
    // if regex or string, pass through
    if (typeof rule === 'string' || rule instanceof RegExp) {
      return rule;
    }

    // pass already labeled fields through
    if (rule.type === 'FIELD') {
      return rule
    }

    // otherwise, mark as field with argIndex
    return field(`arg${argIndex++}`, rule);
  })

  return seq(
    field('keyword', keyword),
    ...argRules,
    ';'
  )
}

module.exports = grammar({
  name: "bos",

  word: $ => $._identifier,

  conflicts: $ => [
    [$.get_call],
  ],

  extras: $ => [
    /\s|\\\r?\n/,
    $.comment,
    $.directive,
    $.multiline_directive,
  ],

  rules: {
    source_file: $ => repeat(choice($._declaration, ';')),

    _declaration: $ => choice(
      $.piece_declaration,
      $.static_var_declaration,
      $.function_declaration,
    ),

    piece_declaration: $ => seq(
      /piece/i,
      sepBy1(',', field("name", $.piece_name)),
      ';'
    ),
    piece_name: $ => $._identifier,

    static_var_declaration: $ => seq(
      /static-var/i,
      sepBy1(',', field('name', $.var_name)),
      ';'
    ),
    var_name: $ => $._identifier,

    function_declaration: $ => seq(
      field("name", $.func_name),
      field("args", choice('()', seq('(', sepBy1(',', $.arg_name), ')'))),
      field("body", $.statement_block),
    ),
    func_name: $ => $._identifier,
    arg_name: $ => $._identifier,

    statement_block: $ => choice(
      seq('{', repeat($._statement), '}'),
      $._statement,
    ),

    _statement: $ => choice(
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
      sepBy1(',', $.var_name),
      ';'
    ),

    if_statement: $ => prec.left(seq(
      /if/i,
      '(',
      field("condition", $._expression),
      ')',
      field("then", $.statement_block),
      optional(seq(/else/i, field("else", $.statement_block))),
    )),

    while_statement: $ => seq(
      /while/i,
      '(',
      field("condition", $._expression),
      ')',
      field("body", $.statement_block),
    ),

    assign_statement: $ => choice(
      seq(field("name", $.var_name), '=', field("value", $._expression), ';'),
      $.increment_statement,
      $.decrement_statement,
    ),
    increment_statement: $ => seq(
      '++', field("name", $.var_name), ';'
    ),
    decrement_statement: $ => seq(
      '--', field("name", $.var_name), ';'
    ),

    return_statement: $ => seq(
      /return/i,
      optional(field("value", $._expression)),
      ';'
    ),

    keyword_statement: $ => choice(
        $.call_statement,
        $.start_statement,

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
    ),

    axis: $ => choice(
      /x-?axis/i, /y-?axis/i, /z-?axis/i
    ),

    expression_list: $ => sepBy1(',', $._expression),
    call_statement: $ => choice(
      kw(/call-?script/i, $.func_name, '()'),
      kw(/call-?script/i, $.func_name, '(', $.expression_list, ')')
    ),
    start_statement: $ => choice(
      kw(/start-?script/i, $.func_name, '()'),
      kw(/start-?script/i, $.func_name, '(', $.expression_list, ')'),
    ),

    signal_statement: $ => kw(/signal/i, $._expression),
    set_signal_mask_statement: $ => kw(/set-?signal-?mask/i, $._expression),

    sleep_statement: $ => kw(/sleep/i, $._expression),

    set_statement: $ => kw(/set/i, $._expression, /to/i, $._expression),
    get_statement: $ => kw(/get/i, $.get_call),

    spin_statement: $ => kw(
      /spin/i, $.piece_name, /around/i, $.axis, /speed/i, $._expression,
      optional(seq(/accelerate/i, $._expression))
    ),
    stop_spin_statement: $ => kw(
      /stop-?spin/i, $.piece_name, /around/i, $.axis,
      optional(seq(/decelerate/i, $._expression))
    ),

    speed_or_now: $ => choice(/now/i, seq(/speed/i, $._expression)),
    turn_statement: $ => kw(/turn/i, $.piece_name, /to/i, $.axis, $._expression, $.speed_or_now),
    move_statement: $ => kw(/move/i, $.piece_name, /to/i, $.axis, $._expression, $.speed_or_now),

    wait_for_turn_statement: $ => kw(/wait-?for-?turn/i, $.piece_name, /around/i, $.axis,),
    wait_for_move_statement: $ => kw(/wait-?for-?move/i, $.piece_name, /along/i, $.axis,),

    hide_statement: $ => kw(/hide/i, $.piece_name),
    show_statement: $ => kw(/show/i, $.piece_name),

    // play_sound_statement: $ => undefined,
    emit_sfx_statement: $ => kw(/emit-?sfx/i, $._expression, /from/i, $.piece_name),
    explode_statement: $ => kw(/explode/i, $.piece_name, /type/i, $._expression),

    attach_unit_statement: $ => kw(/attach-?unit/i, $._expression, /to/i, $._expression),
    drop_unit_statement: $ => kw(/drop-?unit/i, $._expression),

    cache_statement: $ => kw(/cache/i, $.piece_name),
    dont_cache_statement: $ => kw(/dont-?cache/i, $.piece_name),
    dont_shadow_statement: $ => kw(/dont-?shadow/i, $.piece_name),
    dont_shade_statement: $ => kw(/dont-?shade/i, $.piece_name),

    _expression: $ => choice(
      prec(100, seq('(', $._expression, ')')),
      prec(90, $.const_term),
      prec(80, $.varying_term),
      prec(70, $.unary_expression),
      prec(60, $.binary_expression),
    ),

    const_term: $ => choice(
      prec(92, seq('(', $.constant, ')')),
      prec(91, $.constant),
    ),

    varying_term: $ => choice(
      prec(83, $.rand_term),
      prec(82, seq(/get/i, $.get_call)),
      prec(81, $.var_name)
    ),

    unary_expression: $ => choice(
      prec(72, seq(choice('!', /not/i), $._expression)),
      // negation not supported at this time
    ),

    binary_expression: $ => choice(
      prec(62, $.multiplicative_expression),
      prec(61, $.additive_expression),
      prec(51, $.comparative_expression),
      prec(50, $.equals_expression),
      prec(40, $.bitwise_expression),
      prec(30, $.logical_expression),
    ),

    multiplicative_expression: $ => prec.left(62, seq(
      field('operand1', $._expression),
      field('operator', choice('*', '/', '%')),
      field('operand2', $._expression),
    )),

    additive_expression: $ => prec.left(61, seq(
      field('operand1', $._expression),
      field('operator', choice('+', '-')),
      field('operand2', $._expression),
    )),

    comparative_expression: $ => prec.left(51, seq(
      field('operand1', $._expression),
      field('operator', choice('<', '>', '<=', '>=')),
      field('operand2', $._expression),
    )),

    equals_expression: $ => prec.left(50, seq(
      field('operand1', $._expression),
      field('operator', choice('==', '!=')),
      field('operand2', $._expression),
    )),

    bitwise_expression: $ => choice(
      prec.left(43, seq(field('operand1', $._expression), field('operator', '&'), field('operand2', $._expression))),
      prec.left(42, seq(field('operand1', $._expression), field('operator', '|'), field('operand2', $._expression))),
      prec.left(41, seq(field('operand1', $._expression), field('operator', '^'), field('operand2', $._expression))),
    ),

    logical_expression: $ => choice(
      prec.left(33, seq(field('operand1', $._expression), field('operator', choice('&&', /and/i)), field('operand2', $._expression))),
      prec.left(32, seq(field('operand1', $._expression), field('operator', choice('||', /or/i)), field('operand2', $._expression))),
      prec.left(31, seq(field('operand1', $._expression), field('operator', choice('^^', /xor/i)), field('operand2', $._expression))),
    ),

    rand_term: $ => seq(
      /rand/i,
      '(',
      field('lower_bound', $._expression),
      ',',
      field('upper_bound', $._expression),
      ')'
    ),


    get_call: $ => choice(
      prec(1, field('value_index', $._expression)),
      seq(field('value_index', $._expression),
        '(',
        field('arg1', $._expression),
        optional(seq(',', field('arg2', $._expression))),
        optional(seq(',', field('arg3', $._expression))),
        optional(seq(',', field('arg4', $._expression))),
        ')'
      ),
    ),

    constant: $ => choice(
      $.linear_constant,
      $.degree_constant,
      seq(optional('-'), $.number),
    ),

    linear_constant: $ => seq('[', optional('-'), $.number, ']'),
    degree_constant: $ => seq('<', optional('-'), $.number, '>'),
    number: $ => choice($._float, $._integer),
    _float: $ => /[0-9]+\.[0-9]*|\.[0-9]+/,
    _integer: $ => /[0-9]+|0x[0-9a-fA-F]+/,

    _identifier: $ => /[a-z_][a-z_0-9]*/i,


    comment: $ => token(choice(
      seq('//', /(\\+(.|\r?\n)|[^\\\n])*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/',
      ),
    )),
    directive: $ => /#.*/,
    multiline_directive: $ => token(prec(1, /#(?:.*\\\r?\n)+.+/)),
  }
});
