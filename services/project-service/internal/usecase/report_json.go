package usecase

import "encoding/json"

func jsonMarshal(value any) ([]byte, error) {
	return json.Marshal(value)
}

func jsonUnmarshal(raw []byte, out any) error {
	return json.Unmarshal(raw, out)
}
