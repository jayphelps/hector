/**
 * This first part was boosted from the JavaScript grammar by David Majda and
 * collabs over at https://github.com/dmajda/pegjs
 */

start
    = __ template:Template __ {
        return template;
    }

SourceCharacter
    = .

EOL "end of line" = [\n\r]

EOF = !.

WhiteSpace "whitespace"
  = [ \t\v\f]

Comment "comment"
  = MultiLineComment
  / SingleLineComment

MultiLineComment
  = "/*" (!"*/" SourceCharacter)* "*/"

MultiLineCommentNoEOL
  = "/*" (!("*/" / EOL) SourceCharacter)* "*/"

SingleLineComment
  = "//" (!EOL SourceCharacter)*

_ = (WhiteSpace / MultiLineCommentNoEOL / SingleLineComment)*

__ = (WhiteSpace / EOL / Comment)*

DoubleStringCharacters
    = chars:DoubleStringCharacter+ { return chars.join(""); }

SingleStringCharacters
    = chars:SingleStringCharacter+ { return chars.join(""); }

DoubleStringCharacter
    = !('"' / "\\" / EOL) char_:SourceCharacter { return char_;    }
    / "\\" sequence:EscapeSequence              { return sequence; }
    / LineContinuation

SingleStringCharacter
    = !("'" / "\\" / EOL) char_:SourceCharacter { return char_;    }
    / "\\" sequence:EscapeSequence              { return sequence; }
    / LineContinuation

LineContinuation
    = "\\" sequence:EOL { return sequence; }

EscapeSequence
    = CharacterEscapeSequence

CharacterEscapeSequence
    = SingleEscapeCharacter
    / NonEscapeCharacter

SingleEscapeCharacter
    = char_:['"\\bfnrtv] {
        return char_
            .replace("b", "\b")
            .replace("f", "\f")
            .replace("n", "\n")
            .replace("r", "\r")
            .replace("t", "\t")
            .replace("v", "\x0B") // IE does not recognize "\v".
    }

NonEscapeCharacter
    = (!EscapeCharacter / EOL) char_:SourceCharacter { return char_; }

EscapeCharacter
  = SingleEscapeCharacter
  / DecimalDigit
  / "x"
  / "u"

DecimalDigits
  = digits:DecimalDigit+ { return digits.join(""); }

DecimalDigit
  = [0-9]

Identifier "identifier"
    = start:IdentifierStart parts:IdentifierPart* {
        var str = start + parts.join("");
        Hector.symbols.add(str);
        return str;
    }

IdentifierStart
    = [a-zA-Z_]

IdentifierPart
    = IdentifierStart
    / [0-9]

DEF         = "def" !IdentifierPart
SAFE_ACCESS = "?"   !IdentifierPart

StringLiteral "string"
    = parts:('"' DoubleStringCharacters? '"' / "'" SingleStringCharacters? "'") {
        return {
            type: "StringLiteral",
            attributes: [],
            value: "\"" + parts[1] + "\""
        };
    }

Variable "variable"
    = "$" start:IdentifierStart parts:IdentifierPart* useSafeAccess:SAFE_ACCESS? __ attributes:Attributes? {
        var str = start + parts.join("");
        Hector.symbols.add(str);
        return {
            type: "Variable",
            value: str,
            isConditional: !!useSafeAccess,
            attributes: attributes || []
        };
    }

VariableStatement "variable"
    = variable:Variable __ ";" {
        variable.type = "VariableStatement";
        return variable;
    }

Property "property"
    = head:Identifier tail:("." Identifier)* {
        var result = [head];
        for (var i = 0, l = tail.length; i < l; i++) {
            result.push(tail[i][1]);
        }

        return result.join(".");
    }

Attribute
    = id:Property __ "=" __ value:(StringLiteral / Variable / Identifier) {
        return {
            type: "AttributeStatement",
            key: id,
            value: value
        }
    }

Attributes
    = head:Attribute tail:(__ Attribute)* {
        var result = [head];
        for (var i = 0, l = tail.length; i < l; i++) {
            result.push(tail[i][1]);
        }

        return result;
    }

Argument
    = id:Identifier __ ":" __ value:(StringLiteral / Variable / ViewStatementNoEOL) __ ";" {
        return {
            type: "Argument",
            key: id,
            value: value
        };
    }

Arguments
    = head:Argument tail:(__ Argument)* {
        var result = [head];
        for (var i = 0, l = tail.length; i < l; i++) {
            result.push(tail[i][1]);
        }

        return result;
    }

Children
    = SourceElements
    / Arguments

ViewStatement
    = id:Identifier __ attributes:Attributes? __ ";" {
        return {
            type: "ViewStatement",
            constructorName: id,
            value: id,
            attributes: attributes || [],
            children: []
        };
    }
    / id:(Variable / Identifier) __ attributes:Attributes? __ "{" children:(__ Children)* __ "}" {
        children = children[0];
        return {
            type: "ViewStatement",
            constructorName: id,
            value: id,
            attributes: attributes || [],
            children: (children && children[1]) || []
        };
    }

ViewStatementNoEOL
    = id:Identifier __ attributes:Attributes? {
        return {
            type: "ViewStatement",
            constructorName: id,
            value: id,
            attributes: attributes || [],
            children: []
        };
    }

ViewDeclaration
    = DEF __ declaration:ViewStatement {
        declaration.type = "ViewDeclaration";
        var attributes = declaration.attributes;
        for (var i = 0, l = attributes.length; i < l; i++) {
            attributes[i].type = "AttributeDeclaration";
        }

        return declaration;
    }

SourceElement
    = ViewDeclaration
    / ViewStatement
    / VariableStatement
    / StringLiteral

SourceElements
    = head:SourceElement tail:(__ SourceElement)* {
        var result = [head];
        for (var i = 0, l = tail.length; i < l; i++) {
            result.push(tail[i][1]);
        }

        return result;
    }

Template
    = nodes:SourceElements? {
        return {
            nodes: nodes
        };
    }