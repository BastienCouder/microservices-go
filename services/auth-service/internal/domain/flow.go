package domain

import "encoding/json"

type BrowserFlow struct {
	ID    string `json:"id"`
	State string `json:"state"`
	UI    struct {
		Nodes []FlowNode `json:"nodes"`
	} `json:"ui"`
}

type FlowNode struct {
	Attributes struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	} `json:"attributes"`
}

func (f *BrowserFlow) CSRFToken() string {
	if f == nil {
		return ""
	}
	for _, node := range f.UI.Nodes {
		if node.Attributes.Name == "csrf_token" {
			return node.Attributes.Value
		}
	}
	return ""
}

type LogoutInitResponse struct {
	LogoutURL string `json:"logout_url"`
}

type RawJSON = json.RawMessage
