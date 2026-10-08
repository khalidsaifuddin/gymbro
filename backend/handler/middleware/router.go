package middleware

import "github.com/gin-gonic/gin"

func NewRouter() *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "gymbro"})
	})
	return router
}
