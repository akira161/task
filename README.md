# 持ち物チェック (mochimono)

毎日決めた時刻に「持ち物は全部ありますか?」とポップアップを出すアプリです。
**全項目にチェックを入れるまでポップアップは閉じられません**(×ボタン・Escでは閉じない、常に最前面)。

- 通知時刻を複数設定可能
- 「いつもの持ち物」(毎日)+「特別な持ち物」(日付指定で事前登録、その日だけ追加)
- 設定画面から編集。常駐中でも設定は自動反映

## 必要なもの
Python 3.9+ と tkinter(Windows/macOS の標準Pythonには同梱。Linuxは `sudo apt install python3-tk`)。外部ライブラリ不要。

## 使い方
```
python -m mochimono settings   # 設定画面(時刻・持ち物・特別な持ち物)
python -m mochimono run        # 常駐して時刻に通知(既定)
python -m mochimono test       # 今日のリストを今すぐ表示して動作確認
```
設定は `~/.mochimono/config.json`(環境変数 `MOCHIMONO_DIR` で変更可)。

PC起動が予定時刻に遅れた場合も、60分以内なら起動時に通知します。

## 自動起動
- Windows: `pythonw -m mochimono run` のショートカットを `shell:startup` フォルダに置く
- macOS: ログイン項目 or launchd に `python3 -m mochimono run` を登録
- Linux: 自動起動アプリケーションに `python3 -m mochimono run` を追加

## テスト
`python -m unittest discover -s tests`
