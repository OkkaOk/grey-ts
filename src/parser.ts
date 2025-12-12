import ts from "typescript";

export function parseCode(fileName: string, code: string): ts.SourceFile {
    return ts.createSourceFile(
        fileName,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );
}

export default parseCode;
