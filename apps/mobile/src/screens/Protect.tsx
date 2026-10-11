import { useState } from "react";
import { Text } from "react-native";
import { baseName, protectPdf, withExtension } from "@gattaimate/pdf-core";
import FileTool from "../FileTool";
import { Field, s } from "../ui";

export default function Protect() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <FileTool id="protect" kind="pdf" readPages={false} actionLabel="Protect & share"
      options={() => (<>
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label="Repeat password" value={confirm} onChangeText={setConfirm} secureTextEntry hint="Anyone opening the PDF will need this password and we can’t recover it. Standard RC4 128-bit PDF protection works everywhere but is a light deterrent, not strong encryption." />
        <Text style={s.hint}>Removing a password is available in the web app.</Text>
      </>)}
      run={async ({ file, bytes }) => {
        if (password !== confirm) throw new Error("The two passwords don't match.");
        const out = await protectPdf(await bytes(), password);
        return { name: withExtension(`${baseName(file.name)}-protected`, ".pdf"), mime: "application/pdf", bytes: out, message: "Protected copy ready. It now asks for the password to open." };
      }} />
  );
}
