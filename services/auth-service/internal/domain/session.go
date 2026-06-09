package domain

type Session struct {
	ID       string   `json:"id"`
	Active   bool     `json:"active"`
	Identity Identity `json:"identity"`
}

type Identity struct {
	ID     string `json:"id"`
	Traits Traits `json:"traits"`
}

type Traits struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}
