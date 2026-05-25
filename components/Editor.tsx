"use client";

import Editor from "@monaco-editor/react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  language?: "python" | "javascript" | "typescript";
  height?: string;
}

export default function CodeEditor({
  value,
  onChange,
  language = "python",
  height = "400px",
}: Props) {
  return (
    <div className="border border-zinc-800 rounded overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="vs-dark"
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 4,
          insertSpaces: true,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          renderWhitespace: "selection",
        }}
      />
    </div>
  );
}
