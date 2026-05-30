package domain

import (
	"fmt"
	"sort"
	"time"
)

var ErrInvalidCreditCostSettings = fmt.Errorf("invalid credit cost settings")

type CreditCostRule struct {
	MinPricePerMillion float64 `json:"min_price_per_million"`
	CreditCost         int     `json:"credit_cost"`
}

type CreditCostSettings struct {
	DefaultCreditCost int              `json:"default_credit_cost"`
	Rules             []CreditCostRule `json:"rules"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

func (s *CreditCostSettings) Validate() error {
	if s.DefaultCreditCost <= 0 {
		return fmt.Errorf("%w: default credit cost must be positive", ErrInvalidCreditCostSettings)
	}
	normalizedRules := make([]CreditCostRule, 0, len(s.Rules))
	for _, rule := range s.Rules {
		if rule.MinPricePerMillion < 0 {
			return fmt.Errorf("%w: minimum price cannot be negative", ErrInvalidCreditCostSettings)
		}
		if rule.CreditCost <= 0 {
			return fmt.Errorf("%w: credit cost must be positive", ErrInvalidCreditCostSettings)
		}
		normalizedRules = append(normalizedRules, rule)
	}
	sort.SliceStable(normalizedRules, func(i, j int) bool {
		if normalizedRules[i].MinPricePerMillion == normalizedRules[j].MinPricePerMillion {
			return normalizedRules[i].CreditCost > normalizedRules[j].CreditCost
		}
		return normalizedRules[i].MinPricePerMillion > normalizedRules[j].MinPricePerMillion
	})
	s.Rules = normalizedRules
	return nil
}
