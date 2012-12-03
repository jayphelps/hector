start
    = __ template:template __ {
        return template;
    }

template
    = nodes:rootElements? {
        return {
            nodes: nodes
        };
    }

rootElements
    = head:rootElement tail:(__ rootElement)* {
        var result = [head];
        for (var i = 0, l = tail.length; i < l; i++) {
            result.push(tail[i][1]);
        }

        return result;
    }

rootElement
    = variableStatement
    / viewDeclaration
    / viewInstance
    / helper
    / value:stringLiteral {
        return {
            type: "String",
            attributes: [],
            value: value
        };
    }

elements
    = head:element tail:(__ element)* {
        var result = [head];
        for (var i = 0, l = tail.length; i < l; i++) {
            result.push(tail[i][1]);
        }

        return result;
    }

element
    = variableStatement
    / viewInstance
    / helper
    / value:stringLiteral {
        return {
            type: "String",
            attributes: [],
            value: value
        };
    }

helper
    = "<" __ id1:identifier __ argument:identifier? __ attributes:attributes? __ ">"
          inner:(!"</" (helper / sourceCharacter))*
      "</" __ id2:identifier __ ">" {

        var children = [];
        var content = "";
        var a;

        for (var i = 0, l = inner.length; i < l; i++) {
            a = inner[i][1];
            if (a.type) {
                if (content) {
                    children.push({
                        type: "String",
                        value: content
                    });
                }

                children.push(a);
                content = "";
            } else {
                content += a;
            }
        }

        if (content) {
            children.push({
                type: "String",
                value: content
            });
        }

        return {
            type: "Html",
            identifier: id1,
            argument: argument,
            attributes: attributes || [],
            children: children
        };
    }

viewDeclaration
    = "def" __ inst:viewInstance {
        inst.type = "ViewDeclaration";
        return inst;
    }

viewInstance
    = id:(variable / identifier) __ attributes:attributes? __ ";" {
        return {
            type: "View",
            constructorName: id,
            value: id,
            attributes: attributes || [],
            children: []
        };
    }
    / id:(variable / identifier) __ attributes:attributes? __ "{" children:(__ children)* __ "}" {
        children = children[0];
        return {
            type: "View",
            constructorName: id,
            value: id,
            attributes: attributes || [],
            children: (children && children[1]) || []
        };
    }

viewInstanceNoEOL
    = id:identifier __ attributes:attributes? {
        return {
            type: "View",
            constructorName: id,
            value: id,
            attributes: attributes || [],
            children: []
        };
    }

children
    = elements
    / arguments

arguments
    = head:argument tail:(__ argument)* {
        var result = [head];
        for (var i = 0, l = tail.length; i < l; i++) {
            result.push(tail[i][1]);
        }

        return result;
    }

argument
    = id:identifier __ ":" __ value:(stringLiteral / variable / viewInstanceNoEOL) __ ";" {
        return {
            type: "Argument",
            key: id,
            value: value
        };
    }

attributes
    = head:attribute tail:(__ attribute)* {
        var result = [head];
        for (var i = 0, l = tail.length; i < l; i++) {
            result.push(tail[i][1]);
        }

        return result;
    }

attribute
    = id:property __ "=" __ value:(stringLiteral / variable / identifier) {
        return {
            type: "Attribute",
            key: id,
            value: value
        }
    }

property "property"
    = head:identifier tail:("." identifier)* {
        var result = [head];
        for (var i = 0, l = tail.length; i < l; i++) {
            result.push(tail[i][1]);
        }

        return result.join(".");
    }

variableStatement "variableStatement"
    = variable:variable __ ";" {
        variable.type = "VariableStatement";
        return variable;
    }

variable "variable"
    = "$" start:identifierStart parts:identifierPart* conditional:"?"? __ attributes:attributes? {
        return {
            type: "Variable",
            value: start + parts.join(""),
            isConditional: !!conditional,
            attributes: attributes || []
        };
    }

identifier "identifier"
    = start:identifierStart parts:identifierPart* {
        return start + parts.join("");
    }

identifierStart
    = [a-zA-Z_]

identifierPart
    = identifierStart
    / [0-9]

stringLiteral "string"
  = parts:('"' doubleStringCharacters? '"' / "'" singleStringCharacters? "'") {
      return "\""+parts[1]+"\"";
    }

doubleStringCharacters
  = chars:doubleStringCharacter+ { return chars.join(""); }

singleStringCharacters
  = chars:singleStringCharacter+ { return chars.join(""); }

doubleStringCharacter
  = !('"' / "\\" / EOL) char_:sourceCharacter { return char_;    }
  / "\\" sequence:escapeSequence              { return sequence; }
  / lineContinuation

singleStringCharacter
  = !("'" / "\\" / EOL) char_:sourceCharacter { return char_;    }
  / "\\" sequence:escapeSequence              { return sequence; }
  / lineContinuation

lineContinuation
  = "\\" sequence:EOL { return sequence; }

escapeSequence
  = characterescapeSequence

characterescapeSequence
  = singleescapeCharacter
  / nonescapeCharacter

singleescapeCharacter
  = char_:['"\\bfnrtv] {
      return char_
        .replace("b", "\b")
        .replace("f", "\f")
        .replace("n", "\n")
        .replace("r", "\r")
        .replace("t", "\t")
        .replace("v", "\x0B") // IE does not recognize "\v".
    }

nonescapeCharacter
  = (!escapeCharacter / EOL) char_:sourceCharacter { return char_; }

escapeCharacter
  = singleescapeCharacter
  / decimalDigit
  / "x"
  / "u"

decimalDigits
  = digits:decimalDigit+ { return digits.join(""); }

decimalDigit
  = [0-9]

whiteSpace "whitespace"
    = [ \t\v\f]

EOL "end of line"
    = [\n\r]

comment "comment"
    = multiLineComment
    / singleLineComment

multiLineComment
    = "/*" (!"*/" sourceCharacter)* "*/"

multiLineCommentNoEOL
    = "/*" (!("*/" / EOL) sourceCharacter)* "*/"

singleLineComment
    = "//" (!EOL sourceCharacter)*

EOF = !.

/* Whitespace */

_ = (whiteSpace / multiLineCommentNoEOL / singleLineComment)*

__ = (whiteSpace / EOL / comment)*

sourceCharacter
    = .