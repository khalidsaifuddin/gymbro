package middleware

import (
	"github.com/gin-gonic/gin"
	"io"
)

func NewRouter() *gin.Engine {
	router := gin.New()
	router.Use(gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, _ any) { c.AbortWithStatusJSON(500, gin.H{"error": "internal_error"}) }))
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "gymbro"})
	})
	return router
}
