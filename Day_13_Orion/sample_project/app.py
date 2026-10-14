import streamlit as st
from chat import get_client, stream_response
from config import PAGE_ICON, PAGE_TITLE

st.set_page_config(page_title=PAGE_TITLE, page_icon=PAGE_ICON)
st.title(f"{PAGE_ICON} {PAGE_TITLE}")

api_key = st.sidebar.text_input("OpenRouter API Key", type="password")
if not api_key:
    st.warning("Enter your OpenRouter API key to start.")
    st.stop()

client = get_client(api_key)

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Ask me anything..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        response_text = st.write_stream(
            stream_response(client, st.session_state.messages)
        )

    st.session_state.messages.append({"role": "assistant", "content": response_text})
