from __future__ import unicode_literals
from . import ast


def indent(content):
    return "    ".join(
        content.splitlines(True)
    )


def includes_new_line(elem):
    return isinstance(elem, ast.TextElement) and "\n" in elem.value


def is_select_expr(elem):
    return (
        isinstance(elem, ast.Placeable) and
        isinstance(elem.expression, ast.SelectExpression))


class FluentSerializer(object):
    HAS_ENTRIES = 1

    def __init__(self, with_junk=False):
        self.with_junk = with_junk

    def serialize(self, resource):
        if not isinstance(resource, ast.Resource):
            raise Exception('Unknown resource type: {}'.format(type(resource)))

        state = 0

        parts = []
        for entry in resource.body:
            if not isinstance(entry, ast.Junk) or self.with_junk:
                parts.append(self.serialize_entry(entry, state))
                if not state & self.HAS_ENTRIES:
                    state |= self.HAS_ENTRIES

        return "".join(parts)

    def serialize_entry(self, entry, state=0):
        if isinstance(entry, ast.Message):
            return serialize_message(entry)
        if isinstance(entry, ast.Term):
            return serialize_message(entry)
        if isinstance(entry, ast.Comment):
            if state & self.HAS_ENTRIES:
                return "\n{}\n".format(serialize_comment(entry, "#"))
            return "{}\n".format(serialize_comment(entry, "#"))
        if isinstance(entry, ast.GroupComment):
            if state & self.HAS_ENTRIES:
                return "\n{}\n".format(serialize_comment(entry, "##"))
            return "{}\n".format(serialize_comment(entry, "##"))
        if isinstance(entry, ast.ResourceComment):
            if state & self.HAS_ENTRIES:
                return "\n{}\n".format(serialize_comment(entry, "###"))
            return "{}\n".format(serialize_comment(entry, "###"))
        if isinstance(entry, ast.Junk):
            return serialize_junk(entry)
        raise Exception('Unknown entry type: {}'.format(type(entry)))

    def serialize_expression(self, expr):
        return serialize_expression(expr)


def serialize_comment(comment, prefix="#"):
    prefixed = "\n".join([
        prefix if len(line) == 0 else "{} {}".format(prefix, line)
        for line in comment.content.splitlines(False)
    ])
    # Add the trailing line break.
    return '{}\n'.format(prefixed)


def serialize_junk(junk):
    return junk.content


def serialize_message(message):
    parts = []

    if message.comment:
        parts.append(serialize_comment(message.comment))

    parts.append(serialize_identifier(message.id))
    parts.append(" =")

    if message.value:
        parts.append(serialize_value(message.value))

    if message.attributes:
        for attribute in message.attributes:
            parts.append(serialize_attribute(attribute))

    parts.append("\n")

    return ''.join(parts)


def serialize_attribute(attribute):
    return "\n    .{} ={}".format(
        serialize_identifier(attribute.id),
        indent(serialize_value(attribute.value))
    )


def serialize_value(value):
    if isinstance(value, ast.Pattern):
        return serialize_pattern(value)
    if isinstance(value, ast.VariantList):
        return serialize_variant_list(value)
    raise Exception('Unknown value type: {}'.format(type(value)))


def serialize_pattern(pattern):
    content = "".join([
        serialize_element(elem)
        for elem in pattern.elements])
    start_on_new_line = any(
        includes_new_line(elem) or is_select_expr(elem)
        for elem in pattern.elements)
    if start_on_new_line:
        return '\n    {}'.format(indent(content))

    return ' {}'.format(content)


def serialize_variant_list(varlist):
    content = "".join([
        serialize_variant(variant)
        for variant in varlist.variants])
    return '\n    {{{}\n    }}'.format(indent(content))


def serialize_variant(variant):
    return "\n{}[{}]{}".format(
        "   *" if variant.default else "    ",
        serialize_variant_key(variant.key),
        indent(serialize_value(variant.value))
    )


def serialize_element(element):
    if isinstance(element, ast.TextElement):
        return serialize_text_element(element)
    if isinstance(element, ast.Placeable):
        return serialize_placeable(element)
    raise Exception('Unknown element type: {}'.format(type(element)))


def serialize_text_element(text):
    return text.value


def serialize_placeable(placeable):
    expr = placeable.expression

    if isinstance(expr, ast.Placeable):
        return "{{{}}}".format(serialize_placeable(expr))
    if isinstance(expr, ast.SelectExpression):
        # Special-case select expressions to control the withespace around the
        # opening and the closing brace.
        return "{{ {}}}".format(serialize_select_expression(expr))
    if isinstance(expr, ast.Expression):
        return "{{ {} }}".format(serialize_expression(expr))


def serialize_expression(expression):
    if isinstance(expression, ast.StringLiteral):
        return serialize_string_literal(expression)
    if isinstance(expression, ast.NumberLiteral):
        return serialize_number_literal(expression)
    if isinstance(expression, ast.MessageReference):
        return serialize_message_reference(expression)
    if isinstance(expression, ast.TermReference):
        return serialize_message_reference(expression)
    if isinstance(expression, ast.VariableReference):
        return serialize_variable_reference(expression)
    if isinstance(expression, ast.AttributeExpression):
        return serialize_attribute_expression(expression)
    if isinstance(expression, ast.VariantExpression):
        return serialize_variant_expression(expression)
    if isinstance(expression, ast.CallExpression):
        return serialize_call_expression(expression)
    if isinstance(expression, ast.SelectExpression):
        return serialize_select_expression(expression)
    if isinstance(expression, ast.Placeable):
        return serialize_placeable(expression)
    raise Exception('Unknown expression type: {}'.format(type(expression)))


def serialize_string_literal(expr):
    return "\"{}\"".format(expr.value)


def serialize_number_literal(expr):
    return expr.value


def serialize_message_reference(expr):
    return serialize_identifier(expr.id)


def serialize_variable_reference(expr):
    return "${}".format(serialize_identifier(expr.id))


def serialize_select_expression(expr):
    parts = []
    selector = "{} ->".format(
        serialize_expression(expr.selector))
    parts.append(selector)

    for variant in expr.variants:
        parts.append(serialize_variant(variant))

    parts.append("\n")

    return "".join(parts)


def serialize_attribute_expression(expr):
    return "{}.{}".format(
        serialize_expression(expr.ref),
        serialize_identifier(expr.name),
    )


def serialize_variant_expression(expr):
    return "{}[{}]".format(
        serialize_expression(expr.ref),
        serialize_variant_key(expr.key),
    )


def serialize_call_expression(expr):
    fun = serialize_function(expr.callee)
    positional = ", ".join(
        serialize_expression(arg) for arg in expr.positional)
    named = ", ".join(
        serialize_named_argument(arg) for arg in expr.named)
    if len(expr.positional) > 0 and len(expr.named) > 0:
        return '{}({}, {})'.format(fun, positional, named)
    return '{}({})'.format(fun, positional or named)


def serialize_call_argument(arg):
    if isinstance(arg, ast.Expression):
        return serialize_expression(arg)
    if isinstance(arg, ast.NamedArgument):
        return serialize_named_argument(arg)


def serialize_named_argument(arg):
    return "{}: {}".format(
        serialize_identifier(arg.name),
        serialize_argument_value(arg.value)
    )


def serialize_argument_value(argval):
    if isinstance(argval, ast.StringLiteral):
        return serialize_string_literal(argval)
    if isinstance(argval, ast.NumberLiteral):
        return serialize_number_literal(argval)
    raise Exception('Unknown argument type: {}'.format(type(argval)))


def serialize_identifier(identifier):
    return identifier.name


def serialize_variant_name(symbol):
    return symbol.name


def serialize_variant_key(key):
    if isinstance(key, ast.Identifier):
        return serialize_identifier(key)
    if isinstance(key, ast.NumberLiteral):
        return serialize_number_literal(key)
    raise Exception('Unknown variant key type: {}'.format(type(key)))


def serialize_function(function):
    return function.name
